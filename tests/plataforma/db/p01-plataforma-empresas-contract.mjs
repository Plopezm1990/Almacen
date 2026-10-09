// PLATAFORMA F1 — contrato con Postgres real (base desechable, solo loopback).
//
// Comprueba, con las funciones reales de la migración
// 20261009120000_plataforma_f1_administrador_y_empresas.sql y la versión PM29 real
// de guardar_contexto_instalacion_ui, que:
//   * solo el administrador de plataforma puede listar, crear, desactivar y reactivar;
//   * crear es transaccional, idempotente por operation_id y rechaza duplicados;
//   * desactivar arrastra locales y membresías y reactivar devuelve exactamente eso;
//   * mientras no hay administradores, crear empresas desde la pantalla sigue como antes,
//     y en cuanto hay uno, un Propietario normal ya no puede;
//   * los roles de la API no pueden llamar a lo privado ni leer las tablas privadas.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.PLATAFORMA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/plataforma_p01_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Solo se admiten bases de datos de loopback');
assert.equal(url.pathname, '/plataforma_p01_test', 'Solo se admite la base desechable plataforma_p01_test');

const MIGRACION = process.env.PLATAFORMA_MIGRACION || 'supabase/migrations/20261009120000_plataforma_f1_administrador_y_empresas.sql';
const PM29 = 'supabase/migrations/20260918120000_pm29_desactivar_empresa_propietario.sql';
const sql = (p) => fs.readFileSync(p, 'utf8');

const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const DUENO_B = '00000000-0000-4000-8000-0000000000b1';
const CAJERO = '00000000-0000-4000-8000-0000000000c1';
const NUEVO = '00000000-0000-4000-8000-0000000000d1';
const EMPLEADO = '00000000-0000-4000-8000-0000000000e1';
const FANTASMA = '00000000-0000-4000-8000-0000000000f1';

const admin = new pg.Client({ connectionString: url.href });
await admin.connect();
const clientes = [];

async function como(uid, rol = 'authenticated') {
  const c = new pg.Client({ connectionString: url.href });
  await c.connect();
  clientes.push(c);
  await c.query("select set_config('plataforma.actor', $1, false)", [uid || '']);
  await c.query(`set role ${rol}`);
  return c;
}

async function fallo(promesa, { code, mensaje }, etiqueta) {
  try {
    await promesa;
  } catch (e) {
    if (code) assert.equal(e.code, code, `${etiqueta}: código esperado ${code}, llegó ${e.code} (${e.message})`);
    if (mensaje) assert.ok(String(e.message).includes(mensaje), `${etiqueta}: mensaje esperado «${mensaje}», llegó «${e.message}»`);
    return;
  }
  assert.fail(`${etiqueta}: debía fallar y no falló`);
}

const rpc = async (c, nombre, args = []) => {
  const marcas = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${nombre}(${marcas}) as r`, args)).rows[0].r;
};

const extraerFuncion = (fuente, cabecera) => {
  const i = fuente.indexOf(cabecera);
  assert.ok(i >= 0, cabecera);
  const fin = fuente.indexOf('$$;', fuente.indexOf('$$', i) + 2);
  assert.ok(fin > i, cabecera);
  return fuente.slice(i, fin + 3);
};

try {
  assert.equal((await admin.query('select current_database() as db')).rows[0].db, 'plataforma_p01_test');

  // --- Esquema mínimo, con las restricciones reales de producción -------------
  await admin.query(`
    drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade;
    create schema public; create schema private; create schema auth;
    do $$begin
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    end$$;
    grant usage on schema public, private, auth to authenticated, anon;

    create table auth.users (id uuid primary key, email text, deleted_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('plataforma.actor', true), '')::uuid $$;

    create table public.perfiles (
      user_id uuid primary key references auth.users(id) on delete cascade,
      rol text not null default 'Básico',
      empleado_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      nombre text,
      activo boolean not null default true,
      constraint perfiles_rol_check check (rol in ('Propietario','Encargado','Básico','Camarero/a','Cajero/a','Churrero/a'))
    );
    create table public.empresas (
      id text primary key, nombre text not null, activo boolean not null default true,
      created_at timestamptz not null default now(), datos jsonb not null default '{}'::jsonb
    );
    create table public.locales (
      id text primary key, empresa_id text not null references public.empresas(id),
      nombre text not null, activo boolean not null default true,
      created_at timestamptz not null default now(), datos jsonb not null default '{}'::jsonb
    );
    create table public.membresias_usuario (
      id bigint primary key, user_id uuid not null references auth.users(id) on delete cascade,
      empresa_id text not null, local_id text, todos_locales boolean not null default false,
      rol text not null, activo boolean not null default true,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      constraint pm12_prod_membresia_empresa check (nullif(btrim(empresa_id), '') is not null),
      constraint pm12_prod_membresia_local check ((todos_locales = true and local_id is null) or (todos_locales = false and nullif(btrim(local_id), '') is not null))
    );
    create table private.la_instalacion_estado (singleton boolean primary key default true, generation text not null);

    -- guardar_contexto_instalacion_ui termina devolviendo el contexto completo; aquí basta con un sustituto.
    create function public.obtener_contexto_instalacion_ui() returns jsonb language sql stable as $$ select jsonb_build_object('ok', true) $$;

    -- Un solo permiso de tabla para la API: lo mínimo para que las funciones definer no dependan de él.
    grant select on public.empresas, public.locales, public.membresias_usuario, public.perfiles to authenticated;
  `);

  await admin.query(extraerFuncion(sql(PM29), 'create or replace function public.guardar_contexto_instalacion_ui('));
  await admin.query('grant execute on function public.guardar_contexto_instalacion_ui(text, jsonb) to authenticated');

  // --- Datos de partida ------------------------------------------------------
  await admin.query(`
    insert into auth.users(id, email) values
      ('${ADMIN}', 'admin@example.test'), ('${DUENO_B}', 'duenob@example.test'),
      ('${CAJERO}', 'cajero@example.test'), ('${NUEVO}', 'nuevo@example.test'),
      ('${EMPLEADO}', 'empleado@example.test');
    insert into public.perfiles(user_id, rol, nombre) values
      ('${ADMIN}', 'Propietario', 'Admin'), ('${DUENO_B}', 'Propietario', 'Dueño B'),
      ('${CAJERO}', 'Cajero/a', 'Cajero');
    insert into public.perfiles(user_id, rol, nombre, empleado_id) values ('${EMPLEADO}', 'Camarero/a', 'Empleado', 'EMP-1');
    insert into public.empresas(id, nombre, datos) values ('E-LEGADO', 'Empresa Legado', '{"nif":"B00000001"}');
    insert into public.locales(id, empresa_id, nombre) values ('L-LEGADO', 'E-LEGADO', 'Local Legado');
    insert into public.membresias_usuario(id, user_id, empresa_id, todos_locales, rol)
      values (1, '${DUENO_B}', 'E-LEGADO', true, 'Propietario');
  `);

  // --- Migración real ---------------------------------------------------------
  await admin.query(sql(MIGRACION));

  const cAdmin = await como(ADMIN);
  const cDuenoB = await como(DUENO_B);
  const cCajero = await como(CAJERO);
  const cNuevo = await como(NUEVO);
  const cAnon = await como('', 'anon');

  // === Sin administradores registrados: todo como antes =======================
  {
    const r = await rpc(cDuenoB, 'plataforma_estado');
    assert.deepEqual(r, { es_admin: false }, 'sin administradores nadie es administrador');
    await fallo(rpc(cDuenoB, 'plataforma_listar_empresas'), { code: '42501', mensaje: 'Administrador de plataforma requerido' }, 'listar sin ser admin');

    // Camino heredado: un Propietario crea una empresa desde la pantalla (guardar_contexto_instalacion_ui).
    const nueva = [{ id: 'E-PANTALLA-1', razonSocial: 'Empresa de pantalla uno' }];
    const g = await rpc(cDuenoB, 'guardar_contexto_instalacion_ui', ['empresas', JSON.stringify(nueva)]);
    assert.ok(g, 'el camino heredado sigue funcionando sin administradores');
    assert.equal((await admin.query("select count(*)::int n from public.empresas where id='E-PANTALLA-1'")).rows[0].n, 1);
  }

  // === Registro del administrador ============================================
  await fallo(admin.query("select private.plataforma_registrar_admin($1)", [CAJERO]), { code: '22023', mensaje: 'perfil Propietario activo' }, 'registrar admin con perfil no Propietario');
  await fallo(cAdmin.query("select private.plataforma_registrar_admin($1)", [ADMIN]), { code: '42501' }, 'la API no puede registrar administradores');
  await fallo(cAdmin.query('select * from private.plataforma_admins'), { code: '42501' }, 'la API no lee plataforma_admins');
  await fallo(cAdmin.query('select * from private.plataforma_auditoria'), { code: '42501' }, 'la API no lee la auditoría');
  await fallo(cAdmin.query('select * from private.plataforma_bajas'), { code: '42501' }, 'la API no lee las bajas');
  await admin.query("select private.plataforma_registrar_admin($1, 'prueba')", [ADMIN]);
  await admin.query("select private.plataforma_registrar_admin($1, 'prueba')", [ADMIN]); // idempotente

  // === Estado y permisos ======================================================
  {
    const r = await rpc(cAdmin, 'plataforma_estado');
    assert.equal(r.es_admin, true);
    assert.equal(r.empresas_activas, 2);
    assert.equal(r.empresas_desactivadas, 0);
    assert.deepEqual(await rpc(cDuenoB, 'plataforma_estado'), { es_admin: false });
    assert.deepEqual(await rpc(cCajero, 'plataforma_estado'), { es_admin: false });
    await fallo(rpc(cAnon, 'plataforma_estado'), { code: '42501' }, 'anon no ejecuta plataforma_estado');
    await fallo(cAnon.query("select public.plataforma_listar_empresas()"), { code: '42501' }, 'anon no ejecuta listar');
    const sinSesion = await como('');
    await fallo(rpc(sinSesion, 'plataforma_estado'), { code: '42501', mensaje: 'Sesión requerida' }, 'sin sesión');
  }

  // === Guarda en guardar_contexto_instalacion_ui con administrador ============
  {
    await fallo(
      rpc(cDuenoB, 'guardar_contexto_instalacion_ui', ['empresas', JSON.stringify([{ id: 'E-PANTALLA-2', razonSocial: 'Otra por pantalla' }])]),
      { code: '42501', mensaje: 'Solo el administrador de la plataforma puede crear empresas' },
      'Propietario normal ya no crea empresas con administrador registrado'
    );
    assert.equal((await admin.query("select count(*)::int n from public.empresas where id='E-PANTALLA-2'")).rows[0].n, 0);
    // Lo existente sigue editable por su Propietario (la guarda solo afecta a empresas nuevas).
    await rpc(cDuenoB, 'guardar_contexto_instalacion_ui', ['empresas', JSON.stringify([
      { id: 'E-LEGADO', razonSocial: 'Empresa Legado', nif: 'B00000001' },
      { id: 'E-PANTALLA-1', razonSocial: 'Empresa de pantalla uno (editada)' },
    ])]);
    assert.equal((await admin.query("select nombre from public.empresas where id='E-PANTALLA-1'")).rows[0].nombre, 'Empresa de pantalla uno (editada)');
    // El administrador sí puede crear por la pantalla.
    await rpc(cAdmin, 'guardar_contexto_instalacion_ui', ['empresas', JSON.stringify([{ id: 'E-ADMIN-PANTALLA', razonSocial: 'Creada por el administrador' }])]);
    assert.equal((await admin.query("select count(*)::int n from public.empresas where id='E-ADMIN-PANTALLA'")).rows[0].n, 1);
    await admin.query("delete from public.membresias_usuario where empresa_id in ('E-ADMIN-PANTALLA','E-PANTALLA-1')");
    await admin.query("delete from public.empresas where id in ('E-ADMIN-PANTALLA','E-PANTALLA-1')");
  }

  // === Crear empresa ==========================================================
  let empresaA, localA;
  {
    await fallo(rpc(cDuenoB, 'plataforma_crear_empresa', ['op-crear-nodoable-1', 'No puedo', 'Local', null, null]), { code: '42501' }, 'crear sin ser admin');
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['corto', 'Empresa X', 'Local X', null, null]), { code: '22023', mensaje: 'operation_id inválido' }, 'operation_id corto');
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-invalid-1', 'A', 'Local X', null, null]), { code: '22023', mensaje: 'Nombre de empresa inválido' }, 'nombre corto');
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-invalid-2', 'Empresa X', '', null, null]), { code: '22023', mensaje: 'Nombre de local inválido' }, 'local vacío');
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-invalid-3', 'Empresa X', 'Local X', 'no es un cif!!', null]), { code: '22023', mensaje: 'CIF/NIF no válido' }, 'cif inválido');

    const r = await rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-cliente-a', '  Cliente   Uno  S.L. ', 'Local   Centro', 'b-12.345.678', null]);
    assert.equal(r.ok, true);
    assert.equal(r.propietario_vinculado, false);
    empresaA = r.empresa_id; localA = r.local_id;
    assert.match(empresaA, /^empresa-[0-9a-f]{16}$/);
    assert.match(localA, /^local-[0-9a-f]{16}$/);
    const e = (await admin.query('select * from public.empresas where id=$1', [empresaA])).rows[0];
    assert.equal(e.nombre, 'Cliente Uno S.L.');
    assert.equal(e.activo, true);
    assert.deepEqual(e.datos, { razonSocial: 'Cliente Uno S.L.', marca: 'Cliente Uno S.L.', nif: 'B12345678' });
    const l = (await admin.query('select * from public.locales where id=$1', [localA])).rows[0];
    assert.equal(l.empresa_id, empresaA);
    assert.equal(l.nombre, 'Local Centro');
    assert.equal(l.activo, true);
    assert.equal((await admin.query('select count(*)::int n from public.membresias_usuario where empresa_id=$1', [empresaA])).rows[0].n, 0, 'sin propietario no hay membresías');

    // Idempotencia
    const r2 = await rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-cliente-a', 'Cliente Uno S.L.', 'Local Centro', 'B12345678', null]);
    assert.equal(r2.idempotente, true);
    assert.equal(r2.empresa_id, empresaA);
    assert.equal((await admin.query("select count(*)::int n from public.empresas where nombre='Cliente Uno S.L.'")).rows[0].n, 1);
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-cliente-a', 'Cliente Distinto', 'Local Centro', null, null]), { code: '22023', mensaje: 'reutilizado' }, 'operation_id con otra petición');

    // Duplicados
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-dup-nombre', 'cliente uno s.l.', 'Otro', null, null]), { code: '23505', mensaje: 'ese nombre' }, 'nombre duplicado');
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-dup-cif', 'Cliente Dos', 'Otro', 'B 12345678', null]), { code: '23505', mensaje: 'CIF/NIF' }, 'cif duplicado');

    // Con propietario: la cuenta sin perfil recibe perfil Propietario y membresía
    const r3 = await rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-cliente-b', 'Cliente Dos', 'Local Dos', null, NUEVO]);
    assert.equal(r3.propietario_vinculado, true);
    const p = (await admin.query('select rol, activo from public.perfiles where user_id=$1', [NUEVO])).rows[0];
    assert.deepEqual(p, { rol: 'Propietario', activo: true });
    const m = (await admin.query('select rol, activo, todos_locales, local_id from public.membresias_usuario where empresa_id=$1 and user_id=$2', [r3.empresa_id, NUEVO])).rows;
    assert.deepEqual(m, [{ rol: 'Propietario', activo: true, todos_locales: true, local_id: null }]);

    // Cuentas que no pueden ser dueñas
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-cajero', 'Cliente Tres', 'Local Tres', null, CAJERO]), { code: '22023', mensaje: 'otro rol' }, 'cajero no puede ser propietario');
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-emp', 'Cliente Tres', 'Local Tres', null, EMPLEADO]), { code: '22023', mensaje: 'otro rol' }, 'empleado no puede ser propietario');
    await fallo(rpc(cAdmin, 'plataforma_crear_empresa', ['op-crear-fantasma', 'Cliente Tres', 'Local Tres', null, FANTASMA]), { code: '22023', mensaje: 'no existe' }, 'cuenta inexistente');
    // Todo o nada: ninguna de las tres llegó a crear la empresa.
    assert.equal((await admin.query("select count(*)::int n from public.empresas where nombre='Cliente Tres'")).rows[0].n, 0, 'fallo del propietario revierte la empresa');
    assert.equal((await admin.query("select count(*)::int n from public.locales where nombre='Local Tres'")).rows[0].n, 0, 'fallo del propietario revierte el local');
  }

  // === Asignar propietario ====================================================
  {
    await fallo(rpc(cDuenoB, 'plataforma_asignar_propietario', ['op-asignar-nodoable', empresaA, NUEVO]), { code: '42501' }, 'asignar sin ser admin');
    await fallo(rpc(cAdmin, 'plataforma_asignar_propietario', ['op-asignar-noexiste', 'E-NO-EXISTE', NUEVO]), { code: 'P0002' }, 'empresa inexistente');
    const r = await rpc(cAdmin, 'plataforma_asignar_propietario', ['op-asignar-a-nuevo', empresaA, NUEVO]);
    assert.equal(r.ok, true);
    assert.equal((await admin.query("select count(*)::int n from public.membresias_usuario where empresa_id=$1 and user_id=$2 and activo", [empresaA, NUEVO])).rows[0].n, 1);
    const r2 = await rpc(cAdmin, 'plataforma_asignar_propietario', ['op-asignar-a-nuevo', empresaA, NUEVO]);
    assert.equal(r2.idempotente, true);
    // Repetir con otra operación no duplica la membresía (mismo id determinista).
    await rpc(cAdmin, 'plataforma_asignar_propietario', ['op-asignar-a-nuevo-2', empresaA, NUEVO]);
    assert.equal((await admin.query("select count(*)::int n from public.membresias_usuario where empresa_id=$1 and user_id=$2", [empresaA, NUEVO])).rows[0].n, 1);
  }

  // === Listar =================================================================
  {
    const lista = await rpc(cAdmin, 'plataforma_listar_empresas');
    const a = lista.find((x) => x.id === empresaA);
    assert.ok(a, 'la empresa nueva aparece');
    assert.equal(a.activa, true);
    assert.equal(a.locales_activos, 1);
    assert.equal(a.locales_total, 1);
    assert.equal(a.usuarios_activos, 1);
    assert.equal(a.propietarios.length, 1);
    assert.equal(a.propietarios[0].email, 'nuevo@example.test');
    // La lista no lleva datos de negocio: solo estas claves.
    assert.deepEqual(Object.keys(a).sort(), ['activa', 'baja_en', 'baja_motivo', 'creada_en', 'id', 'locales_activos', 'locales_total', 'nombre', 'propietarios', 'usuarios_activos', 'usuarios_total']);
  }

  // === Desactivar y reactivar =================================================
  {
    // Preparar: un segundo local inactivo de antes (debe seguir inactivo tras reactivar) y un empleado con membresía.
    await admin.query("insert into public.locales(id, empresa_id, nombre, activo) values ('L-A-2', $1, 'Local viejo', false), ('L-A-3', $1, 'Local tres', true)", [empresaA]);
    await admin.query("insert into public.membresias_usuario(id, user_id, empresa_id, local_id, todos_locales, rol) values (900, $1, $2, 'L-A-3', false, 'Cajero/a')", [CAJERO, empresaA]);
    const antes = (await admin.query("select count(*)::int n from public.membresias_usuario where empresa_id=$1 and activo", [empresaA])).rows[0].n;
    assert.equal(antes, 2);

    await fallo(rpc(cDuenoB, 'plataforma_desactivar_empresa', ['op-desact-nodoable', empresaA, 'x']), { code: '42501' }, 'desactivar sin ser admin');
    await fallo(rpc(cAdmin, 'plataforma_desactivar_empresa', ['op-desact-noexiste', 'E-NO-EXISTE', null]), { code: 'P0002' }, 'desactivar inexistente');

    const d = await rpc(cAdmin, 'plataforma_desactivar_empresa', ['op-desact-cliente-a', empresaA, '  Fin de contrato ']);
    assert.deepEqual(d, { ok: true, empresa_id: empresaA, ya_estaba_desactivada: false, membresias_desactivadas: 2, locales_desactivados: 2 });
    assert.equal((await admin.query('select activo from public.empresas where id=$1', [empresaA])).rows[0].activo, false);
    assert.deepEqual((await admin.query('select id, activo from public.locales where empresa_id=$1', [empresaA])).rows.map((x) => `${x.id}:${x.activo}`).sort(), [`${localA}:false`, 'L-A-2:false', 'L-A-3:false'].sort());
    assert.equal((await admin.query('select count(*)::int n from public.membresias_usuario where empresa_id=$1 and activo', [empresaA])).rows[0].n, 0);
    const baja = (await admin.query('select motivo, cardinality(membresias_desactivadas) m, cardinality(locales_desactivados) l from private.plataforma_bajas where empresa_id=$1', [empresaA])).rows[0];
    assert.deepEqual(baja, { motivo: 'Fin de contrato', m: 2, l: 2 });
    // Los datos de otras empresas no se tocan.
    assert.equal((await admin.query("select activo from public.empresas where id='E-LEGADO'")).rows[0].activo, true);
    assert.equal((await admin.query("select count(*)::int n from public.membresias_usuario where empresa_id='E-LEGADO' and activo")).rows[0].n, 1);

    const lista = await rpc(cAdmin, 'plataforma_listar_empresas');
    const a = lista.find((x) => x.id === empresaA);
    assert.equal(a.activa, false);
    assert.equal(a.baja_motivo, 'Fin de contrato');
    assert.ok(a.baja_en);

    const d2 = await rpc(cAdmin, 'plataforma_desactivar_empresa', ['op-desact-cliente-a', empresaA, 'Fin de contrato']);
    assert.equal(d2.idempotente, true);
    const d3 = await rpc(cAdmin, 'plataforma_desactivar_empresa', ['op-desact-cliente-a-bis', empresaA, 'otra vez']);
    assert.equal(d3.ya_estaba_desactivada, true);
    assert.equal((await admin.query('select count(*)::int n from private.plataforma_bajas where empresa_id=$1', [empresaA])).rows[0].n, 1, 'una desactivación repetida no reescribe la baja');

    // Reactivar
    await fallo(rpc(cDuenoB, 'plataforma_reactivar_empresa', ['op-react-nodoable', empresaA]), { code: '42501' }, 'reactivar sin ser admin');
    const r = await rpc(cAdmin, 'plataforma_reactivar_empresa', ['op-react-cliente-a', empresaA]);
    assert.deepEqual(r, { ok: true, empresa_id: empresaA, ya_estaba_activa: false, sin_registro_de_baja: false, locales_reactivados: 2, membresias_reactivadas: 2 });
    assert.equal((await admin.query('select activo from public.empresas where id=$1', [empresaA])).rows[0].activo, true);
    const locales = (await admin.query('select id, activo from public.locales where empresa_id=$1', [empresaA])).rows.map((x) => `${x.id}:${x.activo}`).sort();
    assert.deepEqual(locales, [`${localA}:true`, 'L-A-2:false', 'L-A-3:true'].sort(), 'el local que ya estaba inactivo antes de la baja sigue inactivo');
    assert.equal((await admin.query('select count(*)::int n from public.membresias_usuario where empresa_id=$1 and activo', [empresaA])).rows[0].n, 2);
    assert.equal((await admin.query('select count(*)::int n from private.plataforma_bajas where empresa_id=$1 and reactivada_en is null', [empresaA])).rows[0].n, 0, 'ya no hay baja vigente');
    assert.equal((await admin.query('select count(*)::int n from private.plataforma_bajas where empresa_id=$1 and reactivada_en is not null', [empresaA])).rows[0].n, 1, 'la baja reactivada queda como historial, no se borra');
    assert.equal((await rpc(cAdmin, 'plataforma_listar_empresas')).find((x) => x.id === empresaA).baja_en, null, 'una empresa reactivada no muestra baja');
    assert.equal((await rpc(cAdmin, 'plataforma_reactivar_empresa', ['op-react-cliente-a', empresaA])).idempotente, true);
    assert.equal((await rpc(cAdmin, 'plataforma_reactivar_empresa', ['op-react-cliente-a-bis', empresaA])).ya_estaba_activa, true);

    // Un segundo ciclo baja/reactivación reutiliza la fila de baja: vuelve a ser vigente y luego a quedar como historial.
    const d4 = await rpc(cAdmin, 'plataforma_desactivar_empresa', ['op-desact-cliente-a-ciclo2', empresaA, 'segundo ciclo']);
    assert.equal(d4.membresias_desactivadas, 2);
    assert.equal(d4.locales_desactivados, 2);
    const vigente = (await admin.query('select motivo, reactivada_en from private.plataforma_bajas where empresa_id=$1', [empresaA])).rows;
    assert.deepEqual(vigente, [{ motivo: 'segundo ciclo', reactivada_en: null }], 'la baja nueva es vigente y sustituye a la anterior');
    assert.equal((await rpc(cAdmin, 'plataforma_listar_empresas')).find((x) => x.id === empresaA).baja_motivo, 'segundo ciclo');
    const r3 = await rpc(cAdmin, 'plataforma_reactivar_empresa', ['op-react-cliente-a-ciclo2', empresaA]);
    assert.equal(r3.locales_reactivados, 2);
    assert.equal(r3.membresias_reactivadas, 2);
    assert.deepEqual((await admin.query('select id, activo from public.locales where empresa_id=$1', [empresaA])).rows.map((x) => `${x.id}:${x.activo}`).sort(), [`${localA}:true`, 'L-A-2:false', 'L-A-3:true'].sort());

    // Baja hecha por otra vía (sin registro): se reactiva la empresa y su local más antiguo; las membresías no se tocan.
    await admin.query("update public.locales set activo=false where empresa_id=$1", [empresaA]);
    await admin.query("update public.empresas set activo=false where id=$1", [empresaA]);
    const r2 = await rpc(cAdmin, 'plataforma_reactivar_empresa', ['op-react-sin-registro', empresaA]);
    assert.equal(r2.sin_registro_de_baja, true);
    assert.equal(r2.locales_reactivados, 1);
    assert.equal(r2.membresias_reactivadas, 0);
    assert.equal((await admin.query("select count(*)::int n from public.locales where empresa_id=$1 and activo", [empresaA])).rows[0].n, 1);
  }

  // === Auditoría: una fila por operación, sin datos de negocio ================
  {
    const filas = (await admin.query('select accion, count(*)::int n from private.plataforma_auditoria group by accion order by accion')).rows;
    const mapa = Object.fromEntries(filas.map((x) => [x.accion, x.n]));
    assert.equal(mapa.crear_empresa, 2);
    assert.equal(mapa.asignar_propietario, 2);
    assert.equal(mapa.desactivar_empresa, 3);
    assert.equal(mapa.reactivar_empresa, 4);
    assert.equal((await admin.query('select count(*)::int n from private.plataforma_auditoria where actor is null')).rows[0].n, 0);
  }

  // === El perfil desactivado deja de ser administrador ========================
  {
    await admin.query("update public.perfiles set activo=false where user_id=$1", [ADMIN]);
    assert.deepEqual(await rpc(cAdmin, 'plataforma_estado'), { es_admin: false });
    await fallo(rpc(cAdmin, 'plataforma_listar_empresas'), { code: '42501' }, 'admin con perfil desactivado');
    await admin.query("update public.perfiles set activo=true where user_id=$1", [ADMIN]);
    assert.equal((await rpc(cAdmin, 'plataforma_estado')).es_admin, true);
  }

  // === Contrato estático del archivo de migración =============================
  {
    const m = sql(MIGRACION);
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/i.test(m.replace(/--.*$/gm, '')), 'la migración no lleva identificadores de cuenta fijos');
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(m.replace(/--.*$/gm, '')), 'la migración no lleva correos');
    for (const fn of ['plataforma_estado()', 'plataforma_listar_empresas()', 'plataforma_crear_empresa(text, text, text, text, uuid)', 'plataforma_asignar_propietario(text, text, uuid)', 'plataforma_desactivar_empresa(text, text, text)', 'plataforma_reactivar_empresa(text, text)']) {
      assert.ok(m.includes(`revoke all on function public.${fn} from public, anon;`), `falta revoke de ${fn}`);
      assert.ok(m.includes(`grant execute on function public.${fn} to authenticated;`), `falta grant de ${fn}`);
    }
    assert.ok(m.includes("<> '0110df5a2e37f879c7086be3c33a69af'"), 'falta la huella de la versión PM29');
    assert.ok(!/\bdelete\s+from\s+public\./i.test(m.replace(/--.*$/gm, '')), 'la fase 1 no borra datos de ninguna tabla pública');
    assert.ok(!/\bdrop\s+(table|schema|function)/i.test(m.replace(/--.*$/gm, '')), 'la fase 1 no elimina objetos');
  }

  console.log('PLATAFORMA_P01_EMPRESAS=PASS');
} finally {
  for (const c of clientes) await c.end().catch(() => {});
  await admin.end().catch(() => {});
}

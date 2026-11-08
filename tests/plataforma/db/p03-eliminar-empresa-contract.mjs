// PLATAFORMA F2 — contrato con Postgres real del borrado definitivo de una empresa (base desechable, solo loopback).
//
// Carga la versión PM29 real de guardar_contexto_instalacion_ui y las dos migraciones de plataforma
// (fase 1 y fase 2) sobre un esquema mínimo con las restricciones reales de producción, más tablas de
// ejemplo que reproducen lo difícil: cadena de claves ajenas con RESTRICT, clave ajena a sí misma,
// tablas con disparador de inmutabilidad (en la lista cerrada y fuera de ella), tablas atribuidas por
// local (notificaciones, fichajes, movimientos), una tabla global sin empresa y almacen_kv.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.PLATAFORMA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/plataforma_p01_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Solo se admiten bases de datos de loopback');
assert.equal(url.pathname, '/plataforma_p01_test', 'Solo se admite la base desechable plataforma_p01_test');

const F1 = process.env.PLATAFORMA_MIGRACION || 'supabase/migrations/20261009120000_plataforma_f1_administrador_y_empresas.sql';
const F2 = process.env.PLATAFORMA_MIGRACION_F2 || 'supabase/migrations/20261009130000_plataforma_f2_eliminar_empresa.sql';
const PM29 = 'supabase/migrations/20260918120000_pm29_desactivar_empresa_propietario.sql';
const sql = (p) => fs.readFileSync(p, 'utf8');

const U = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const ADMIN = U('a1'), DUENO_B = U('b1'), OWN1 = U('c1'), STAFF1 = U('c2'), SHARED = U('c3'), OWN2 = U('d1'), OWN3 = U('d2');

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
  try { await promesa; } catch (e) {
    if (code) assert.equal(e.code, code, `${etiqueta}: código esperado ${code}, llegó ${e.code} (${e.message})`);
    if (mensaje) assert.ok(String(e.message).includes(mensaje), `${etiqueta}: mensaje esperado «${mensaje}», llegó «${e.message}»`);
    return;
  }
  assert.fail(`${etiqueta}: debía fallar y no falló`);
}
const rpc = async (c, nombre, args = []) => (await c.query(`select public.${nombre}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args)).rows[0].r;
const extraer = (fuente, cabecera) => {
  const i = fuente.indexOf(cabecera); assert.ok(i >= 0, cabecera);
  const fin = fuente.indexOf('$$;', fuente.indexOf('$$', i) + 2); assert.ok(fin > i, cabecera);
  return fuente.slice(i, fin + 3);
};
const n = async (consulta, args = []) => (await admin.query(consulta, args)).rows[0].n;
let seq = 0;
const op = (p) => `${p}-${Date.now().toString(36)}-${++seq}`;

try {
  assert.equal((await admin.query('select current_database() as db')).rows[0].db, 'plataforma_p01_test');

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
      rol text not null default 'Básico', empleado_id text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      nombre text, activo boolean not null default true,
      constraint perfiles_rol_check check (rol in ('Propietario','Encargado','Básico','Camarero/a','Cajero/a','Churrero/a'))
    );
    create table public.empresas (id text primary key, nombre text not null, activo boolean not null default true, created_at timestamptz not null default now(), datos jsonb not null default '{}'::jsonb);
    create table public.locales (id text primary key, empresa_id text not null references public.empresas(id), nombre text not null, activo boolean not null default true, created_at timestamptz not null default now(), datos jsonb not null default '{}'::jsonb, unique (empresa_id, id));
    create table public.membresias_usuario (
      id bigint primary key, user_id uuid not null references auth.users(id) on delete cascade,
      empresa_id text not null, local_id text, todos_locales boolean not null default false,
      rol text not null, activo boolean not null default true,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      constraint pm12_prod_membresia_empresa check (nullif(btrim(empresa_id), '') is not null),
      constraint pm12_prod_membresia_local check ((todos_locales = true and local_id is null) or (todos_locales = false and nullif(btrim(local_id), '') is not null))
    );
    create function public.obtener_contexto_instalacion_ui() returns jsonb language sql stable as $$ select jsonb_build_object('ok', true) $$;

    -- Tablas de ejemplo (cada una reproduce un caso real del esquema)
    -- Tablas internas (schema private): una con datos de empresa y clave ajena compuesta a locales, y otras globales declaradas
    create table private.abc_operating_day_reglas (id uuid primary key default gen_random_uuid(), empresa_id text not null, local_id text not null, foreign key (empresa_id, local_id) references public.locales(empresa_id, id) on delete restrict);
    create table private.la_instalacion_estado (singleton boolean primary key default true);
    create table private.g1_operation_ids_global (operation_id text primary key);
    create table public.empleados (id text primary key, empresa_id text not null, local_id text);
    alter table public.perfiles add constraint pm11_perfiles_empleado_fk foreign key (empleado_id) references public.empleados(id) on update restrict on delete restrict;
    create table public.entidades_fiscales (id bigint generated always as identity primary key, empresa_id text not null references public.empresas(id) on delete restrict, nombre_legal text);
    create table public.proveedores_empresa (id text primary key, empresa_id text not null, nombre text);
    create table public.pedidos_tpv (id text primary key, empresa_id text not null, local_id text, creado_por uuid references auth.users(id) on delete restrict);
    create table public.pedido_lineas (id text primary key, empresa_id text not null, pedido_id text not null references public.pedidos_tpv(id) on delete restrict);
    create table public.pedido_linea_opciones (id text primary key, empresa_id text not null, linea_id text not null references public.pedido_lineas(id) on delete restrict);
    create table public.categorias (id text primary key, empresa_id text not null, padre_id text references public.categorias(id));
    create table public.suscripciones_push (endpoint text primary key, user_id uuid references auth.users(id) on delete cascade, local_id text);
    create table public.fichajes_registro (id text primary key, fecha date, datos jsonb not null);
    create table public.movimientos_registro (id text primary key, datos jsonb not null);
    create table public.almacen_kv (key text primary key, value jsonb, empresa_id text, local_id text);
    create table public.abc_b06_politica_conceptos (concepto text primary key);
    create table public.operaciones_procesadas (operation_id text primary key);
    -- Inmutables: una en la lista cerrada de disparadores y otra desconocida
    create table public.abc_c09_impresiones_documentales (id text primary key, empresa_id text not null);
    create function public.f_guard_inmutable() returns trigger language plpgsql as $$ begin raise exception 'impresion_documental_inmutable'; end $$;
    create trigger abc_f5_c09_guard_print before delete or update on public.abc_c09_impresiones_documentales for each row execute function public.f_guard_inmutable();
    -- Nombres elegidos para que el orden alfabético sea el contrario al de las claves ajenas (el padre antes que el hijo)
    create table public.aa_padre (id text primary key, empresa_id text not null);
    create table public.zz_hijo (id text primary key, empresa_id text not null, padre_id text not null references public.aa_padre(id) on delete restrict);
    -- Una tabla cuyo disparador "resucita" una fila al borrar, para comprobar la verificación final
    create table public.tabla_resucita (id text primary key, empresa_id text not null);
    create function public.f_resucita() returns trigger language plpgsql as $$ begin if old.id not like 'resucitada-%' then insert into public.tabla_resucita values ('resucitada-' || old.id, old.empresa_id); end if; return old; end $$;
    create trigger resucita_al_borrar after delete on public.tabla_resucita for each row execute function public.f_resucita();
    create table public.tabla_inmutable_desconocida (id text primary key, empresa_id text not null);
    create trigger otro_guard_desconocido before delete or update on public.tabla_inmutable_desconocida for each row execute function public.f_guard_inmutable();
  `);

  await admin.query(extraer(sql(PM29), 'create or replace function public.guardar_contexto_instalacion_ui('));
  await admin.query('grant execute on function public.guardar_contexto_instalacion_ui(text, jsonb) to authenticated');
  await admin.query(sql(F1));
  await admin.query(sql(F2));

  const cAdmin = await como(ADMIN);
  const cDueno = await como(DUENO_B);
  const cAnon = await como('', 'anon');

  async function sembrarEmpresa(id, local, { cuentas = [], filas = true } = {}) {
    await admin.query('insert into public.empresas(id, nombre) values ($1, $2)', [id, `Empresa ${id}`]);
    await admin.query('insert into public.locales(id, empresa_id, nombre) values ($1, $2, $3)', [local, id, `Local ${local}`]);
    await admin.query('insert into private.abc_operating_day_reglas(empresa_id, local_id) values ($1, $2)', [id, local]);
    await admin.query("insert into public.entidades_fiscales(empresa_id, nombre_legal) values ($1, 'Razón legal')", [id]);
    for (const [uid, rol] of cuentas) {
      await admin.query("insert into auth.users(id, email) values ($1, $2) on conflict do nothing", [uid, `u${uid.slice(-2)}@example.test`]);
      await admin.query("insert into public.perfiles(user_id, rol, nombre) values ($1, $2, 'cuenta') on conflict do nothing", [uid, rol]);
      await admin.query('insert into public.membresias_usuario(id, user_id, empresa_id, todos_locales, rol) values (hashtextextended($1::text || $2::text, 0) & 9223372036854775807, $1::uuid, $2::text, true, $3::text)', [uid, id, rol]);
    }
    if (!filas) return;
    const d = id.replace(/\W/g, '_');
    await admin.query(`insert into public.proveedores_empresa values ('prov-${d}-1', $1, 'P1'), ('prov-${d}-2', $1, 'P2')`, [id]);
    await admin.query(`insert into public.pedidos_tpv values ('ped-${d}-1', $1, $2, $3::uuid)`, [id, local, cuentas[0] ? cuentas[0][0] : null]);
    await admin.query(`insert into public.pedido_lineas values ('lin-${d}-1', $1, 'ped-${d}-1'), ('lin-${d}-2', $1, 'ped-${d}-1')`, [id]);
    await admin.query(`insert into public.pedido_linea_opciones values ('opc-${d}-1', $1, 'lin-${d}-1')`, [id]);
    await admin.query(`insert into public.empleados values ('emp-${d}-1', $1, $2)`, [id, local]);
    if (cuentas[1]) await admin.query(`update public.perfiles set empleado_id = 'emp-${d}-1' where user_id = $1::uuid`, [cuentas[1][0]]);
    await admin.query(`insert into public.almacen_kv values ('kv-${d}-etiquetada', '{}', $1, null)`, [id]);
    await admin.query(`insert into public.aa_padre values ('aap-${d}-1', $1)`, [id]);
    await admin.query(`insert into public.zz_hijo values ('zzh-${d}-1', $1, 'aap-${d}-1')`, [id]);
    await admin.query(`insert into public.categorias values ('cat-${d}-1', $1, null), ('cat-${d}-2', $1, 'cat-${d}-1'), ('cat-${d}-3', $1, 'cat-${d}-2')`, [id]);
    await admin.query(`insert into public.abc_c09_impresiones_documentales values ('imp-${d}-1', $1)`, [id]);
    await admin.query(`insert into public.suscripciones_push values ('ep-${d}-1', $1::uuid, $2)`, [cuentas[0] ? cuentas[0][0] : null, local]);
    await admin.query(`insert into public.fichajes_registro values ('fic-${d}-1', current_date, jsonb_build_object('localId', $1::text, 'empleadoId', 'e1'))`, [local]);
    await admin.query(`insert into public.movimientos_registro values ('mov-${d}-1', jsonb_build_object('localId', $1::text))`, [local]);
  }

  // Datos base: administrador, un dueño normal y una empresa "legado" que NO debe tocarse nunca.
  await admin.query(`insert into auth.users(id, email) values ('${ADMIN}', 'admin@example.test'), ('${DUENO_B}', 'duenob@example.test')`);
  await admin.query(`insert into public.perfiles(user_id, rol, nombre) values ('${ADMIN}', 'Propietario', 'Admin'), ('${DUENO_B}', 'Propietario', 'Dueño B')`);
  await sembrarEmpresa('E-LEGADO', 'L-LEGADO', { cuentas: [[DUENO_B, 'Propietario'], [SHARED, 'Cajero/a']] });
  await admin.query("insert into public.almacen_kv values ('productos', '[1,2,3]', 'E-LEGADO'), ('locales', '[]', null)");
  await admin.query("insert into public.abc_b06_politica_conceptos values ('CONCEPTO')");
  await admin.query("select private.plataforma_registrar_admin($1, 'prueba')", [ADMIN]);

  // === Cobertura: ninguna tabla queda sin decidir ==========================================
  assert.deepEqual((await admin.query('select private.plataforma_tablas_sin_alcance() as t')).rows[0].t, [], 'en el esquema de prueba todas las tablas están decididas (public y private)');
  await admin.query('create table public.tabla_nueva_sin_empresa (id text primary key)');
  assert.deepEqual((await admin.query('select private.plataforma_tablas_sin_alcance() as t')).rows[0].t, ['public.tabla_nueva_sin_empresa'], 'una tabla nueva sin empresa_id aparece como sin decidir');
  await admin.query('drop table public.tabla_nueva_sin_empresa');
  await admin.query('create table private.tabla_interna_nueva (id text primary key)');
  assert.deepEqual((await admin.query('select private.plataforma_tablas_sin_alcance() as t')).rows[0].t, ['private.tabla_interna_nueva'], 'una tabla interna nueva sin decidir también aparece');
  await admin.query('drop table private.tabla_interna_nueva');
  await admin.query('create table public.tabla_nueva_sin_empresa (id text primary key)');
  await admin.query('drop table public.tabla_nueva_sin_empresa');
  await admin.query('create table public.tabla_nueva_con_empresa (id text primary key, empresa_id text not null)');
  const plan = (await admin.query('select tabla, modo from private.plataforma_plan_purga() order by orden')).rows;
  assert.ok(plan.some((x) => x.tabla === 'tabla_nueva_con_empresa' && x.modo === 'empresa_id'), 'una tabla nueva con empresa_id entra sola en el plan de borrado');
  await admin.query('drop table public.tabla_nueva_con_empresa');
  const orden = Object.fromEntries((await admin.query('select tabla, orden from private.plataforma_plan_purga()')).rows.map((x) => [x.tabla, x.orden]));
  assert.ok('abc_operating_day_reglas' in orden && orden.abc_operating_day_reglas < orden.locales, 'las tablas internas con datos de empresa entran en el plan y van antes que locales');
  assert.ok(!('plataforma_auditoria' in orden) && !('plataforma_eliminaciones' in orden) && !('plataforma_bajas' in orden), 'las tablas propias de plataforma (actas, copias, auditoría) nunca se borran');
  assert.ok(orden.pedido_linea_opciones < orden.pedido_lineas && orden.pedido_lineas < orden.pedidos_tpv, 'hijas antes que padres');
  assert.ok('almacen_kv' in orden && !('empresas' in orden) && !('perfiles' in orden), 'almacen_kv (filas etiquetadas) entra en el plan; empresas y perfiles quedan fuera');
  assert.equal(plan.find((x) => x.tabla === 'fichajes_registro').modo, 'datos_localid');
  assert.equal(plan.find((x) => x.tabla === 'suscripciones_push').modo, 'local_id');

  // === Permisos ==============================================================================
  await sembrarEmpresa('E-DEL', 'L-DEL', { cuentas: [[OWN1, 'Propietario'], [STAFF1, 'Cajero/a'], [SHARED, 'Cajero/a'], [ADMIN, 'Propietario']] });
  for (const [f, args] of [['plataforma_resumen_eliminacion', ['E-DEL']], ['plataforma_exportar_empresa', [op('x-exp'), 'E-DEL']], ['plataforma_preparar_eliminacion', [op('x-prep'), 'E-DEL']], ['plataforma_eliminar_empresa', [op('x-elim'), 'E-DEL', 'Empresa E-DEL', 'ABCDEFGH', null]]]) {
    await fallo(rpc(cDueno, f, args), { code: '42501' }, `${f} sin ser administrador`);
    await fallo(rpc(cAnon, f, args), { code: '42501' }, `${f} anon`);
  }
  await fallo(cDueno.query('select private.plataforma_plan_purga()'), { code: '42501' }, 'la API no ve el plan de borrado');
  await fallo(cDueno.query('select * from private.plataforma_eliminaciones'), { code: '42501' }, 'la API no lee las actas');

  // === Puertas ===============================================================================
  {
    const r = await rpc(cAdmin, 'plataforma_resumen_eliminacion', ['E-DEL']);
    assert.equal(r.puede_borrarse, false);
    assert.deepEqual(r.bloqueos.sort(), ['empresa_activa', 'sin_registro_de_baja'].sort(), 'activa y sin baja');
    assert.equal(r.dias_gracia, 30);
    assert.equal(r.cuentas_a_borrar, 2, 'solo las cuentas que pertenecen únicamente a la empresa (no la compartida ni la del administrador)');
    const prep = await rpc(cAdmin, 'plataforma_preparar_eliminacion', [op('prep-activa'), 'E-DEL']);
    assert.equal(prep.ok, false);
    assert.ok(!('codigo' in prep), 'no se entrega código si hay bloqueos');
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-activa'), 'E-DEL', 'Empresa E-DEL', 'ABCDEFGH', 'sin copia de prueba']), { code: '22023', mensaje: 'plataforma_bloqueada: empresa_activa' }, 'empresa activa');

    await rpc(cAdmin, 'plataforma_desactivar_empresa', [op('baja-del'), 'E-DEL', 'fin de contrato']);
    const r2 = await rpc(cAdmin, 'plataforma_resumen_eliminacion', ['E-DEL']);
    assert.deepEqual(r2.bloqueos.sort(), ['plazo_de_gracia', 'sin_copia'].sort(), 'tras la baja: plazo de gracia y sin copia');
    assert.ok(r2.plazo_hasta, 'se informa de cuándo termina el plazo');
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-plazo'), 'E-DEL', 'Empresa E-DEL', 'ABCDEFGH', 'sin copia de prueba']), { code: '22023', mensaje: 'plataforma_bloqueada: plazo_de_gracia' }, 'plazo de gracia');
    assert.equal(await n("select count(*)::int n from public.proveedores_empresa where empresa_id='E-DEL'"), 2, 'nada se borró');

    await admin.query("update private.plataforma_ajustes set valor='0'::jsonb where clave='dias_gracia_borrado'");
    const r3 = await rpc(cAdmin, 'plataforma_resumen_eliminacion', ['E-DEL']);
    assert.deepEqual(r3.bloqueos, ['sin_copia']);
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-sc'), 'E-DEL', 'Empresa E-DEL', 'ABCDEFGH', null]), { code: '22023', mensaje: 'plataforma_bloqueada: sin_copia' }, 'sin copia ni motivo');
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-sc2'), 'E-DEL', 'Empresa E-DEL', 'ABCDEFGH', 'corto']), { code: '22023', mensaje: 'sin_copia' }, 'motivo demasiado corto');
  }

  // === Copia, código y borrado ===============================================================
  let codigo;
  {
    const ex = await rpc(cAdmin, 'plataforma_exportar_empresa', [op('exp-del'), 'E-DEL']);
    assert.equal(ex.ok, true);
    assert.equal(ex.copia.empresa.id, 'E-DEL');
    assert.equal(ex.copia.version, 1);
    assert.match(ex.huella, /^[0-9a-f]{64}$/);
    assert.equal(ex.copia.datos.proveedores_empresa.length, 2);
    assert.equal(ex.copia.datos.fichajes_registro.length, 1, 'fichajes atribuidos por local');
    assert.equal(ex.copia.datos.suscripciones_push.length, 1);
    assert.equal(ex.copia.datos.almacen_kv.length, 1, 'las filas de almacen_kv etiquetadas con la empresa se exportan');
    assert.ok(ex.copia.datos.almacen_kv.every((f) => f.empresa_id === 'E-DEL'), 'y solo esas');
    assert.ok(ex.copia.cuentas.some((c) => c.email && c.rol), 'la copia lleva las cuentas (correo y rol)');
    assert.equal(ex.copia.cuentas.length, 4);
    assert.equal(ex.filas_total, Object.values(ex.copia.filas_por_tabla).reduce((a, b) => a + b, 0));
    const r = await rpc(cAdmin, 'plataforma_resumen_eliminacion', ['E-DEL']);
    assert.deepEqual(r.bloqueos, [], 'con copia hecha tras la baja y plazo cumplido no hay bloqueos');
    assert.equal(r.puede_borrarse, true);
    assert.equal(r.filas_total, ex.filas_total, 'el resumen coincide con la copia');

    const p1 = await rpc(cAdmin, 'plataforma_preparar_eliminacion', [op('prep-1'), 'E-DEL']);
    assert.equal(p1.ok, true);
    assert.match(p1.codigo, /^[0-9A-F]{8}$/);
    const p2 = await rpc(cAdmin, 'plataforma_preparar_eliminacion', [op('prep-2'), 'E-DEL']);
    codigo = p2.codigo;
    assert.notEqual(p2.codigo, p1.codigo);
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-cod1'), 'E-DEL', 'Empresa E-DEL', p1.codigo, null]), { code: '22023', mensaje: 'plataforma_codigo_no_valido' }, 'código anterior invalidado por uno nuevo');
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-cod2'), 'E-DEL', 'Empresa E-DEL', 'XXXXXXXX', null]), { code: '22023', mensaje: 'plataforma_codigo_no_valido' }, 'código erróneo');
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-nom'), 'E-DEL', 'empresa e-del', codigo, null]), { code: '22023', mensaje: 'plataforma_nombre_no_coincide' }, 'nombre distinto');
    await admin.query("update private.plataforma_codigos set expira_en = now() - interval '1 minute' where empresa_id='E-DEL' and usado_en is null");
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-exp'), 'E-DEL', 'Empresa E-DEL', codigo, null]), { code: '22023', mensaje: 'plataforma_codigo_no_valido' }, 'código caducado');
    assert.equal(await n("select count(*)::int n from public.proveedores_empresa where empresa_id='E-DEL'"), 2, 'ninguno de los intentos fallidos borró nada');
    codigo = (await rpc(cAdmin, 'plataforma_preparar_eliminacion', [op('prep-3'), 'E-DEL'])).codigo;
  }

  // === Antes de borrar: foto de lo que NO se debe tocar =======================================
  const foto = async () => JSON.stringify({
    legado: (await admin.query("select (select count(*) from public.proveedores_empresa where empresa_id='E-LEGADO') a, (select count(*) from public.pedidos_tpv where empresa_id='E-LEGADO') b, (select count(*) from public.pedido_lineas where empresa_id='E-LEGADO') c, (select count(*) from public.categorias where empresa_id='E-LEGADO') d, (select count(*) from public.abc_c09_impresiones_documentales where empresa_id='E-LEGADO') e, (select count(*) from public.suscripciones_push where local_id='L-LEGADO') f, (select count(*) from public.fichajes_registro where datos->>'localId'='L-LEGADO') g, (select count(*) from public.movimientos_registro where datos->>'localId'='L-LEGADO') h, (select count(*) from public.membresias_usuario where empresa_id='E-LEGADO') i, (select count(*) from public.locales where empresa_id='E-LEGADO') j, (select count(*) from public.entidades_fiscales where empresa_id='E-LEGADO') k, (select count(*) from private.abc_operating_day_reglas where empresa_id='E-LEGADO') l")).rows[0],
    kv: (await admin.query("select key, value, empresa_id from public.almacen_kv where empresa_id is distinct from 'E-DEL' order by key")).rows,
    global: (await admin.query('select count(*)::int n from public.abc_b06_politica_conceptos')).rows[0],
    cuentasDe: (await admin.query("select id from auth.users where id in ($1,$2,$3) order by id", [SHARED, ADMIN, DUENO_B])).rows,
  });
  const antes = await foto();

  // === El borrado =============================================================================
  let acta;
  {
    const total = await n("select ((select count(*) from public.proveedores_empresa where empresa_id='E-DEL') + (select count(*) from public.pedidos_tpv where empresa_id='E-DEL') + (select count(*) from public.pedido_lineas where empresa_id='E-DEL') + (select count(*) from public.pedido_linea_opciones where empresa_id='E-DEL') + (select count(*) from public.categorias where empresa_id='E-DEL') + (select count(*) from public.abc_c09_impresiones_documentales where empresa_id='E-DEL') + (select count(*) from public.entidades_fiscales where empresa_id='E-DEL') + (select count(*) from public.locales where empresa_id='E-DEL') + (select count(*) from public.membresias_usuario where empresa_id='E-DEL') + (select count(*) from public.empleados where empresa_id='E-DEL') + (select count(*) from public.almacen_kv where empresa_id='E-DEL') + (select count(*) from private.abc_operating_day_reglas where empresa_id='E-DEL') + (select count(*) from public.aa_padre where empresa_id='E-DEL') + (select count(*) from public.zz_hijo where empresa_id='E-DEL') + (select count(*) from public.suscripciones_push where local_id='L-DEL') + (select count(*) from public.fichajes_registro where datos->>'localId'='L-DEL') + (select count(*) from public.movimientos_registro where datos->>'localId'='L-DEL'))::int n");
    const opOk = op('elim-ok');
    const r = await rpc(cAdmin, 'plataforma_eliminar_empresa', [opOk, 'E-DEL', '  Empresa E-DEL  ', codigo.toLowerCase(), null]);
    acta = r;
    assert.equal(r.ok, true);
    assert.equal(r.empresa_id, 'E-DEL');
    assert.equal(r.filas_total, total, 'las filas borradas son exactamente las de la empresa');
    assert.equal(r.cuentas_eliminadas, 2);
    assert.match(r.huella, /^[0-9a-f]{64}$/);

    for (const [t, c] of [['proveedores_empresa', 'empresa_id'], ['pedidos_tpv', 'empresa_id'], ['pedido_lineas', 'empresa_id'], ['pedido_linea_opciones', 'empresa_id'], ['categorias', 'empresa_id'], ['abc_c09_impresiones_documentales', 'empresa_id'], ['entidades_fiscales', 'empresa_id'], ['locales', 'empresa_id'], ['membresias_usuario', 'empresa_id']]) {
      assert.equal(await n(`select count(*)::int n from public.${t} where ${c}='E-DEL'`), 0, `${t} sin restos`);
    }
    assert.equal(await n("select count(*)::int n from public.suscripciones_push where local_id='L-DEL'"), 0);
    assert.equal(await n("select count(*)::int n from public.fichajes_registro where datos->>'localId'='L-DEL'"), 0);
    assert.equal(await n("select count(*)::int n from public.movimientos_registro where datos->>'localId'='L-DEL'"), 0);
    assert.equal(await n("select count(*)::int n from public.empresas where id='E-DEL'"), 0, 'la empresa ya no existe');
    assert.equal(await n("select count(*)::int n from public.almacen_kv where empresa_id='E-DEL'"), 0, 'las filas etiquetadas de almacen_kv se borraron');
    assert.equal(await n("select count(*)::int n from public.almacen_kv where empresa_id is null"), 1, 'las colecciones sin etiqueta no se tocan');
    assert.equal(await n("select count(*)::int n from private.abc_operating_day_reglas where empresa_id='E-DEL'"), 0, 'la tabla interna con clave ajena compuesta a locales también se vació');
    assert.equal(await n("select count(*)::int n from public.aa_padre where empresa_id='E-DEL'") + await n("select count(*)::int n from public.zz_hijo where empresa_id='E-DEL'"), 0, 'el padre y el hijo (orden alfabético contrario) se borraron');
    assert.equal(await n("select count(*)::int n from private.plataforma_codigos where empresa_id='E-DEL' and usado_en is null"), 0, 'el código de un solo uso queda gastado (ninguno sin usar)');
    assert.equal(await n('select count(*)::int n from auth.users where id in ($1,$2)', [OWN1, STAFF1]), 0, 'cuentas exclusivas borradas');
    assert.equal(await n('select count(*)::int n from public.perfiles where user_id in ($1,$2)', [OWN1, STAFF1]), 0, 'sus perfiles también');
    assert.equal(await n('select count(*)::int n from auth.users where id in ($1,$2)', [SHARED, ADMIN]), 2, 'la cuenta compartida y la del administrador se conservan');
    assert.equal(await n("select count(*)::int n from public.membresias_usuario where user_id=$1 and empresa_id='E-LEGADO'", [SHARED]), 1, 'la membresía compartida en la otra empresa sigue');
    assert.equal(await foto(), antes, 'la otra empresa, almacen_kv y las tablas globales quedan idénticos');
    assert.equal(await n("select count(*)::int n from pg_trigger where tgname='abc_f5_c09_guard_print' and tgenabled='O'"), 1, 'el disparador de inmutabilidad vuelve a estar activo');
    await fallo(admin.query("delete from public.abc_c09_impresiones_documentales where id='no-existe'; insert into public.abc_c09_impresiones_documentales values ('x','E-LEGADO'); delete from public.abc_c09_impresiones_documentales where id='x'"), { mensaje: 'impresion_documental_inmutable' }, 'tras el borrado la inmutabilidad sigue protegiendo');

    const a = (await admin.query("select * from private.plataforma_eliminaciones where empresa_id='E-DEL'")).rows;
    assert.equal(a.length, 1);
    assert.equal(a[0].nombre, 'Empresa E-DEL');
    assert.equal(a[0].motivo_baja, 'fin de contrato');
    assert.equal(Number(a[0].filas_total), total);
    assert.equal(a[0].cuentas_eliminadas, 2);
    assert.ok(a[0].huella_copia && a[0].huella_copia.length === 64, 'el acta recoge la huella de la copia');
    assert.equal(a[0].sin_copia_motivo, null);
    assert.equal(await n("select count(*)::int n from private.plataforma_auditoria where accion='eliminar_empresa' and empresa_id='E-DEL'"), 1);

    const rep = await rpc(cAdmin, 'plataforma_eliminar_empresa', [opOk, 'E-DEL', '  Empresa E-DEL  ', codigo.toLowerCase(), null]);
    assert.equal(rep.idempotente, true, 'repetir la misma orden devuelve el mismo resultado sin volver a borrar');
    assert.equal(rep.huella, acta.huella);
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [opOk, 'E-DEL', 'Empresa E-DEL', 'ABCDEFGH', null]), { code: '22023', mensaje: 'reutilizado' }, 'mismo operation_id con otra petición');
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-otra'), 'E-DEL', 'Empresa E-DEL', 'ABCDEFGH', null]), { code: 'P0002' }, 'empresa ya borrada');
  }

  // === Si algo impide el borrado, no se borra NADA (todo o nada) ===============================
  {
    await sembrarEmpresa('E-ATOMICA', 'L-ATOMICA', { cuentas: [[OWN2, 'Propietario']] });
    await admin.query("insert into public.tabla_inmutable_desconocida values ('inm-1', 'E-ATOMICA')");
    await rpc(cAdmin, 'plataforma_desactivar_empresa', [op('baja-at'), 'E-ATOMICA', null]);
    await rpc(cAdmin, 'plataforma_exportar_empresa', [op('exp-at'), 'E-ATOMICA']);
    const c = (await rpc(cAdmin, 'plataforma_preparar_eliminacion', [op('prep-at'), 'E-ATOMICA'])).codigo;
    const antesAt = (await admin.query("select (select count(*) from public.proveedores_empresa where empresa_id='E-ATOMICA')::int a, (select count(*) from public.pedidos_tpv where empresa_id='E-ATOMICA')::int b, (select count(*) from public.membresias_usuario where empresa_id='E-ATOMICA')::int c, (select count(*) from auth.users where id=$1)::int d", [OWN2])).rows[0];
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-at'), 'E-ATOMICA', 'Empresa E-ATOMICA', c, null]), { mensaje: 'impresion_documental_inmutable' }, 'un bloqueo desconocido aborta el borrado');
    const despuesAt = (await admin.query("select (select count(*) from public.proveedores_empresa where empresa_id='E-ATOMICA')::int a, (select count(*) from public.pedidos_tpv where empresa_id='E-ATOMICA')::int b, (select count(*) from public.membresias_usuario where empresa_id='E-ATOMICA')::int c, (select count(*) from auth.users where id=$1)::int d", [OWN2])).rows[0];
    assert.deepEqual(despuesAt, antesAt, 'no se borró nada');
    assert.equal(await n("select count(*)::int n from public.empresas where id='E-ATOMICA'"), 1);
    assert.equal(await n("select count(*)::int n from pg_trigger where tgname='abc_f5_c09_guard_print' and tgenabled='O'"), 1, 'los disparadores quedan como estaban');
    assert.equal(await n("select count(*)::int n from private.plataforma_eliminaciones where empresa_id='E-ATOMICA'"), 0, 'sin acta de un borrado que no ocurrió');
    assert.equal(await n("select count(*)::int n from private.plataforma_codigos where empresa_id='E-ATOMICA' and usado_en is not null"), 0, 'el código no se gasta si el borrado falla');
  }

  // === Si el borrado deja restos (algo vuelve a escribir durante el borrado), se deshace =====
  {
    await sembrarEmpresa('E-RESTOS', 'L-RESTOS', { cuentas: [[U('d3'), 'Propietario']], filas: false });
    await admin.query("insert into public.tabla_resucita values ('res-1', 'E-RESTOS')");
    await rpc(cAdmin, 'plataforma_desactivar_empresa', [op('baja-re'), 'E-RESTOS', null]);
    await rpc(cAdmin, 'plataforma_exportar_empresa', [op('exp-re'), 'E-RESTOS']);
    const c = (await rpc(cAdmin, 'plataforma_preparar_eliminacion', [op('prep-re'), 'E-RESTOS'])).codigo;
    await fallo(rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-re'), 'E-RESTOS', 'Empresa E-RESTOS', c, null]), { mensaje: 'plataforma_restos_tras_borrado' }, 'restos tras el borrado');
    assert.equal(await n("select count(*)::int n from public.empresas where id='E-RESTOS'"), 1, 'todo se deshizo');
    assert.equal(await n("select count(*)::int n from public.tabla_resucita where empresa_id='E-RESTOS' and id='res-1'"), 1);
    assert.equal(await n("select count(*)::int n from public.tabla_resucita where id like 'resucitada-%'"), 0);
  }

  // === Sin copia, con motivo escrito; baja registrada al desactivar algo ya desactivado ========
  {
    await sembrarEmpresa('E-SINCOPIA', 'L-SINCOPIA', { cuentas: [[OWN3, 'Propietario']] });
    await admin.query("update public.empresas set activo=false where id='E-SINCOPIA'");
    assert.equal(await n("select count(*)::int n from private.plataforma_bajas where empresa_id='E-SINCOPIA'"), 0, 'desactivada por otra vía: sin registro de baja');
    const d = await rpc(cAdmin, 'plataforma_desactivar_empresa', [op('baja-sc'), 'E-SINCOPIA', 'cierre del negocio']);
    assert.equal(d.baja_registrada_ahora, true, 'se registra la baja ahora para que empiece el plazo');
    const c = (await rpc(cAdmin, 'plataforma_preparar_eliminacion', [op('prep-sc'), 'E-SINCOPIA'])).codigo;
    assert.ok(c, 'sin_copia no impide recibir el código');
    const r = await rpc(cAdmin, 'plataforma_eliminar_empresa', [op('elim-sc-ok'), 'E-SINCOPIA', 'Empresa E-SINCOPIA', c, 'El cliente renuncia por escrito a la copia']);
    assert.equal(r.ok, true);
    const a = (await admin.query("select sin_copia_motivo, huella_copia from private.plataforma_eliminaciones where empresa_id='E-SINCOPIA'")).rows[0];
    assert.equal(a.sin_copia_motivo, 'El cliente renuncia por escrito a la copia');
    assert.equal(a.huella_copia, null);
  }

  // === Plazo real de 30 días =====================================================================
  {
    await admin.query("update private.plataforma_ajustes set valor='30'::jsonb where clave='dias_gracia_borrado'");
    await sembrarEmpresa('E-PLAZO', 'L-PLAZO', { filas: false });
    await rpc(cAdmin, 'plataforma_desactivar_empresa', [op('baja-pl'), 'E-PLAZO', null]);
    await admin.query("update private.plataforma_bajas set baja_en = now() - interval '29 days' where empresa_id='E-PLAZO'");
    assert.ok((await rpc(cAdmin, 'plataforma_resumen_eliminacion', ['E-PLAZO'])).bloqueos.includes('plazo_de_gracia'), 'a los 29 días aún bloquea');
    await admin.query("update private.plataforma_bajas set baja_en = now() - interval '31 days' where empresa_id='E-PLAZO'");
    assert.ok(!(await rpc(cAdmin, 'plataforma_resumen_eliminacion', ['E-PLAZO'])).bloqueos.includes('plazo_de_gracia'), 'a los 31 días ya no bloquea');
    await rpc(cAdmin, 'plataforma_reactivar_empresa', [op('react-pl'), 'E-PLAZO']);
    assert.ok((await rpc(cAdmin, 'plataforma_resumen_eliminacion', ['E-PLAZO'])).bloqueos.includes('empresa_activa'), 'una empresa reactivada vuelve a estar protegida');
  }

  // === Contrato estático del archivo ============================================================
  {
    const m = sql(F2);
    const codigo = m.replace(/--.*$/gm, '');
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(codigo), 'sin identificadores de cuenta fijos');
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(codigo), 'sin correos');
    assert.equal((codigo.match(/execute format\('delete from /g) || []).length, 1, 'un único sitio de borrado dinámico');
    assert.ok(!/\bdrop\s+(table|schema|function)/i.test(codigo));
    assert.ok(!/session_replication_role/i.test(codigo), 'no se usa el modo réplica; solo la lista cerrada de disparadores');
    assert.ok(/'abc_f5_c09_guard_print', 'abc_f5_c10_guard_delivery', 'abc_f5_c11_guard_reconciliation', 'abc_f5_c12_guard_rehearsal'/.test(codigo), 'lista cerrada de disparadores');
    for (const fn of ['plataforma_resumen_eliminacion(text)', 'plataforma_exportar_empresa(text, text)', 'plataforma_preparar_eliminacion(text, text)', 'plataforma_eliminar_empresa(text, text, text, text, text)']) {
      assert.ok(codigo.includes(`revoke all on function public.${fn} from public, anon;`), `falta revoke ${fn}`);
      assert.ok(codigo.includes(`grant execute on function public.${fn} to authenticated;`), `falta grant ${fn}`);
    }
    assert.ok(codigo.includes('plataforma_restos_tras_borrado'), 'comprobación final de restos');
  }

  console.log('PLATAFORMA_P03_ELIMINAR_EMPRESA=PASS');
} finally {
  for (const c of clientes) await c.end().catch(() => {});
  await admin.end().catch(() => {});
}

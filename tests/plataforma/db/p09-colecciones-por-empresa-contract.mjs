// PLATAFORMA F4 — contrato con Postgres real de las colecciones comunes por empresa (almacen_kv).
//
// Base desechable, solo loopback. Monta dos formas de la tabla:
//   * «qa»: clave primaria (key), políticas PM05, disparadores pm05_scope_almacen_kv y
//     abc_productos_solo_rpc, funciones auxiliares copiadas de QA y la RPC real de P3c
//     (abc_productos_guardar_lista, copia literal en fixtures-f4) más una versión reducida del
//     espejo P3b (abc_catalogo_guardar_productos) con las MISMAS sentencias que la migración P3b;
//   * «prod»: políticas «acceso por rol y clave», sin disparadores ni funciones del paquete ABC.
// Aplica la migración real 20261009140000_plataforma_f4_colecciones_por_empresa.sql y comprueba que:
//   * dos empresas tienen cada una su fila de la misma clave; ninguna ve ni pisa la del otro;
//   * el cliente actual (upsert sin empresa, con la clave primaria por defecto) sigue funcionando;
//   * el rol de la persona EN ESA EMPRESA decide qué claves puede tocar (tabla de producción);
//   * la empresa de una fila no se cambia desde la API y, si es ambigua, falla cerrado;
//   * las funciones del servidor que escribían `where key='productos'` solo tocan la fila de su empresa;
//   * las filas sin empresa se conservan (etiquetadas con la empresa ficticia) y nadie las ve;
//   * la migración es idempotente, atómica y se niega si encuentra algo que no conoce;
//   * (F4d) una empresa dada de baja no cuenta para decidir en qué empresa guarda una cuenta.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.PLATAFORMA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/plataforma_p01_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Solo se admiten bases de datos de loopback');
assert.equal(url.pathname, '/plataforma_p01_test', 'Solo se admite la base desechable plataforma_p01_test');

const F4 = process.env.PLATAFORMA_MIGRACION_F4 || 'supabase/migrations/20261009140000_plataforma_f4_colecciones_por_empresa.sql';
const F4B = process.env.PLATAFORMA_MIGRACION_F4B || 'supabase/migrations/20261009150000_plataforma_f4b_lista_productos_inicial.sql';
const F4C = process.env.PLATAFORMA_MIGRACION_F4C || 'supabase/migrations/20261009160000_plataforma_f4c_lista_sin_contexto_fiscal.sql';
const F4D = process.env.PLATAFORMA_MIGRACION_F4D || 'supabase/migrations/20261009170000_plataforma_f4d_empresas_vigentes.sql';
const P3B = 'supabase/migrations/20261002170000_abc_p3b_espejo_lista_nube.sql';
const FIXTURE_LISTA = 'tests/plataforma/db/fixtures-f4/abc_productos_guardar_lista_qa.sql';
const sql = (p) => fs.readFileSync(p, 'utf8');

const U = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const A_OWN = U('a1'), A_ENC = U('a2'), A_CAJ = U('a3'), A_CAM = U('a4'), A_CHU = U('a5');
const B_OWN = U('b1'), MULTI = U('c1'), NADIE = U('d1'), ADMINP = U('e1'), N_OWN = U('f1'), INACTIVO = U('f2');

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
const n = async (consulta, args = []) => (await admin.query(consulta, args)).rows[0].n;

// La misma sentencia que genera PostgREST para supabase-js `.upsert({ key, value })`:
// columnas del cuerpo (key, value) y ON CONFLICT sobre la clave primaria de la tabla.
async function upsertKv(c, key, value, { conflicto = 'empresa_id, key' } = {}) {
  return c.query(
    `insert into public.almacen_kv ("key", "value")
       select pgrst_body."key", pgrst_body."value"
         from (select $1::json as json_data) pgrst_payload,
              lateral (select case when json_typeof(pgrst_payload.json_data) = 'array' then pgrst_payload.json_data else json_build_array(pgrst_payload.json_data) end as val) pgrst_uniform_body,
              lateral (select "key", "value" from json_to_recordset(pgrst_uniform_body.val) as _("key" text, "value" jsonb)) pgrst_body
       on conflict (${conflicto}) do update set "key" = excluded."key", "value" = excluded."value"`,
    [JSON.stringify([{ key, value }])]
  );
}
const leer = async (c, key) => (await c.query('select empresa_id, key, value from public.almacen_kv where key = $1 order by empresa_id', [key])).rows;

const PRODUCTOS_A = [{ id: 'P1', empresaId: 'E-A', localId: 'L-A1', nombre: 'Pan A', precioVenta: 1, stock: 5 }];
const PRODUCTOS_B = [{ id: 'P1', empresaId: 'E-B', localId: 'L-B1', nombre: 'Pan B', precioVenta: 1, stock: 9 }];

async function montarEsquema(forma, { listaExtra = null, politicaExtra = false } = {}) {
  await admin.query(`
    drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade;
    create schema public; create schema private; create schema auth;
    do $$begin
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    end$$;
    grant usage on schema public, private, auth to authenticated, anon;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('plataforma.actor', true), '')::uuid $$;
    create table public.perfiles (user_id uuid primary key, rol text not null default 'Básico', empleado_id text, activo boolean not null default true);
    create table public.empleados (id text primary key, empresa_id text, local_id text, estado text);
    create table public.empresas (id text primary key, nombre text, activo boolean not null default true);
    create table public.membresias_usuario (
      id bigint primary key, user_id uuid not null, empresa_id text not null, local_id text, todos_locales boolean not null default false,
      rol text not null, activo boolean not null default true
    );
    grant select on public.perfiles, public.empleados, public.empresas, public.membresias_usuario to authenticated;

    -- Funciones auxiliares: copia literal de QA.
    create or replace function private.la_usuario_activo() returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
      select exists (
        select 1 from public.perfiles p
         where p.user_id = auth.uid() and p.activo = true
           and ((p.empleado_id is null and exists (select 1 from public.membresias_usuario m where m.user_id = p.user_id and m.activo = true))
             or (p.empleado_id is not null and exists (
                  select 1 from public.empleados e join public.membresias_usuario m
                    on m.user_id = p.user_id and m.activo = true and m.empresa_id = e.empresa_id
                   and (m.todos_locales = true or (m.todos_locales = false and m.local_id = e.local_id))
                  where e.id = p.empleado_id and e.estado = 'activo')))
      );
    $f$;
    create or replace function private.la_tiene_empresa(p_empresa text) returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
      select private.la_usuario_activo()
         and exists(select 1 from public.membresias_usuario m where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo=true);
    $f$;
    create or replace function private.la_tiene_local(p_empresa text, p_local text) returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
      select private.la_usuario_activo()
         and nullif(btrim(p_local), '') is not null
         and upper(btrim(p_local)) <> 'TODOS'
         and exists(select 1 from public.membresias_usuario m where m.user_id = auth.uid() and m.empresa_id = p_empresa and m.activo = true and (m.todos_locales = true or m.local_id = p_local));
    $f$;
    grant execute on function private.la_tiene_empresa(text), private.la_tiene_local(text, text) to authenticated;

    create table public.almacen_kv (
      key text primary key, value jsonb not null, updated_at timestamptz not null default now(),
      empresa_id text, local_id text
    );
    alter table public.almacen_kv enable row level security;
    grant select, insert, update, delete on public.almacen_kv to authenticated;
  `);

  if (forma === 'qa') {
    await admin.query(`
      create or replace function public.pm05_scope_almacen_kv() returns trigger language plpgsql set search_path to 'public' as $f$
      begin
        new.empresa_id := coalesce(new.value->>'empresaId', new.empresa_id);
        new.local_id := coalesce(new.value->>'localId', new.local_id);
        if new.key like 'qa_pm04:local:%' and new.local_id is null then
          new.local_id := new.value->>'id';
        end if;
        return new;
      end;
      $f$;
      create trigger pm05_scope_almacen_kv_trg before insert or update on public.almacen_kv for each row execute function public.pm05_scope_almacen_kv();
      create or replace function private.abc_productos_solo_rpc() returns trigger language plpgsql set search_path to '' as $f$
      begin
        if current_user in ('authenticated','anon')
           and (case when tg_op='INSERT' then new.key='productos'
                     when tg_op='DELETE' then old.key='productos'
                     else old.key='productos' or new.key='productos' end) then
          raise exception 'abc_productos_escritura_directa_bloqueada' using errcode='42501';
        end if;
        if tg_op='DELETE' then return old; end if;
        return new;
      end $f$;
      create trigger abc_productos_solo_rpc before insert or delete or update on public.almacen_kv for each row execute function private.abc_productos_solo_rpc();

      create policy pm05_almacen_select on public.almacen_kv for select using ((empresa_id is not null) and private.la_tiene_empresa(empresa_id) and ((local_id is null) or private.la_tiene_local(empresa_id, local_id)));
      create policy pm05_almacen_insert on public.almacen_kv for insert with check ((empresa_id is not null) and private.la_tiene_empresa(empresa_id) and ((local_id is null) or private.la_tiene_local(empresa_id, local_id)));
      create policy pm05_almacen_update on public.almacen_kv for update using ((empresa_id is not null) and private.la_tiene_empresa(empresa_id) and ((local_id is null) or private.la_tiene_local(empresa_id, local_id))) with check ((empresa_id is not null) and private.la_tiene_empresa(empresa_id) and ((local_id is null) or private.la_tiene_local(empresa_id, local_id)));
      create policy pm05_almacen_delete on public.almacen_kv for delete using ((empresa_id is not null) and private.la_tiene_empresa(empresa_id) and ((local_id is null) or private.la_tiene_local(empresa_id, local_id)));

      create or replace function private.abc_catalogo_puede_gestionar(p_empresa_id text, p_local_id text) returns boolean language plpgsql stable security definer set search_path to '' as $f$
      declare v_rol text;
      begin
        if auth.uid() is null then return false; end if;
        if nullif(btrim(coalesce(p_empresa_id,'')),'') is null or nullif(btrim(coalesce(p_local_id,'')),'') is null then return false; end if;
        if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;
        select m.rol into v_rol from public.membresias_usuario m
         where m.user_id=auth.uid() and m.empresa_id=p_empresa_id and m.activo=true
           and ((m.todos_locales=false and m.local_id=p_local_id) or (m.todos_locales=true and m.local_id is null))
         order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end, m.id desc limit 1;
        return coalesce(v_rol,'') in ('Propietario','Encargado');
      end $f$;

      -- Versión reducida del espejo P3b: las MISMAS sentencias sobre almacen_kv que la migración P3b.
      create or replace function public.abc_catalogo_guardar_productos(p_operation_id text, p_empresa_id text, p_local_id text, p_currency_code text, p_productos jsonb)
      returns jsonb language plpgsql security definer set search_path to '' as $f$
      declare
        v_kv jsonb; v_kv_nuevo jsonb; v_lista text;
      begin
        if auth.uid() is null or not private.abc_catalogo_puede_gestionar(p_empresa_id,p_local_id) then
          raise exception 'abc_catalogo_no_autorizado';
        end if;
        if p_local_id='L-AMB' then raise exception 'catalogo_contexto_fiscal_ambiguo'; end if;
        if p_empresa_id='E-NEW' then raise exception 'catalogo_contexto_fiscal_ausente'; end if;
        v_lista:='sin_fila';
        select k.value into v_kv
          from public.almacen_kv k
         where k.key='productos' and k.empresa_id=p_empresa_id and jsonb_typeof(k.value)='array'
           for update;
        if found then
          select coalesce(jsonb_agg(
                   case when exists (select 1 from jsonb_array_elements(p_productos) q where q->>'id'=t.e->>'id')
                        then t.e||(select q from jsonb_array_elements(p_productos) q where q->>'id'=t.e->>'id' limit 1)
                        else t.e end
                   order by t.ord),'[]'::jsonb)
            into v_kv_nuevo
            from jsonb_array_elements(v_kv) with ordinality as t(e,ord);
          if v_kv_nuevo is distinct from v_kv then
            update public.almacen_kv set value=v_kv_nuevo, updated_at=now() where key='productos';
            v_lista:='actualizada';
          else
            v_lista:='sin_cambios';
          end if;
        end if;
        return jsonb_build_object('ok',true,'lista_nube',v_lista,'productos','[]'::jsonb);
      end $f$;
    `);
    await admin.query(sql(FIXTURE_LISTA));
    if (listaExtra) await admin.query(listaExtra);
  } else {
    // Producción: políticas «acceso por rol y clave», sin disparadores ni funciones ABC.
    await admin.query(`
      create policy "acceso por rol y clave - select" on public.almacen_kv for select using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo));
      create policy "acceso por rol y clave - insert" on public.almacen_kv for insert with check (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo));
      create policy "acceso por rol y clave - update" on public.almacen_kv for update using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo)) with check (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo));
      create policy "acceso por rol y clave - delete" on public.almacen_kv for delete using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.rol = 'Propietario'));
    `);
  }
  if (politicaExtra) {
    await admin.query(`create policy politica_ajena on public.almacen_kv for select using (true)`);
  }
}

async function datosBase(forma) {
  await admin.query(`
    insert into auth.users(id) values ('${A_OWN}'),('${A_ENC}'),('${A_CAJ}'),('${A_CAM}'),('${A_CHU}'),('${B_OWN}'),('${MULTI}'),('${NADIE}'),('${ADMINP}'),('${N_OWN}'),('${INACTIVO}');
    insert into public.perfiles(user_id, rol) values
      ('${A_OWN}','Propietario'),('${A_ENC}','Encargado'),('${A_CAJ}','Cajero/a'),('${A_CAM}','Camarero/a'),('${A_CHU}','Churrero/a'),
      ('${B_OWN}','Propietario'),('${MULTI}','Propietario'),('${NADIE}','Propietario'),('${ADMINP}','Propietario'),('${N_OWN}','Propietario');
    update public.perfiles set activo = false where user_id = '${INACTIVO}';
    insert into public.empresas(id, nombre) values ('E-A','Empresa A'),('E-B','Empresa B'),('E-NEW','Empresa nueva');
    insert into public.membresias_usuario(id, user_id, empresa_id, local_id, todos_locales, rol) values
      (1,'${A_OWN}','E-A',null,true,'Propietario'),
      (2,'${A_ENC}','E-A','L-A1',false,'Encargado'),
      (3,'${A_CAJ}','E-A','L-A1',false,'Cajero/a'),
      (4,'${A_CAM}','E-A','L-A1',false,'Camarero/a'),
      (5,'${A_CHU}','E-A','L-A1',false,'Churrero/a'),
      (6,'${B_OWN}','E-B',null,true,'Propietario'),
      (7,'${MULTI}','E-A',null,true,'Propietario'),
      (8,'${MULTI}','E-B',null,true,'Propietario'),
      (9,'${N_OWN}','E-NEW',null,true,'Propietario'),
      (10,'${INACTIVO}','E-A',null,true,'Propietario');
  `);
  if (forma === 'qa') {
    await admin.query(`
      insert into public.almacen_kv(key, value, empresa_id) values
        ('productos', $1::jsonb, 'E-A'),
        ('locales', '[{"id":"L-A1","nombre":"Local A1","activo":true}]', 'E-A'),
        ('qa_pm04:manifest', '{"v":1}', null),
        ('qa_pm04:bootstrap_done', '{"ok":true}', null),
        ('qa_pm04:resultado_baseline', '{"r":1}', null)`, [JSON.stringify(PRODUCTOS_A)]);
  } else {
    // Producción: siete colecciones de antes de existir empresas, todas sin etiqueta.
    for (const k of ['catalogoProv', 'conteos', 'disenoMenu', 'historialRespaldos', 'productos', 'temaOscuro', 'traspasos']) {
      await admin.query("insert into public.almacen_kv(key, value) values ($1, '[]')", [k]);
    }
  }
}

const pkDe = async () => (await admin.query("select pg_get_constraintdef(oid) d from pg_constraint where conrelid='public.almacen_kv'::regclass and contype='p'")).rows[0].d;
const politicas = async () => (await admin.query("select polname from pg_policy where polrelid='public.almacen_kv'::regclass order by 1")).rows.map((r) => r.polname);
const defFuncion = async (firma) => (await admin.query('select pg_get_functiondef($1::regprocedure) d', [firma])).rows[0].d;

try {
  assert.equal((await admin.query('select current_database() as db')).rows[0].db, 'plataforma_p01_test');
  const migracion = sql(F4);

  // === 0. Contrato estático: los fragmentos que la migración sustituye existen en el fuente de P3b =========
  {
    const p3b = sql(P3B);
    const frag = "update public.almacen_kv set value=v_kv_nuevo, updated_at=now() where key='productos';";
    assert.equal(p3b.split(frag).length - 1, 1, 'la migración P3b contiene exactamente una vez la sentencia que F4 corrige');
    assert.ok(migracion.includes(frag), 'F4 busca exactamente esa sentencia');
    // La RPC de P3c (fuente en la migración de «lista confirmada») contiene, exactamente una vez, los
    // cuatro fragmentos que F4 sustituye: F4 encaja con la versión que se publicará.
    const p3c = sql('supabase/migrations/20261005100000_abc_p3c_lista_confirmada.sql');
    for (const f of [
      'select k.value,k.empresa_id into v_actual,v_lista_empresa',
      "from public.almacen_kv k where k.key='productos' for update;",
      "update public.almacen_kv set value=v_fusion,updated_at=now() where key='productos';",
      "select k.value into v_fusion from public.almacen_kv k where k.key='productos';",
    ]) {
      assert.equal(p3c.split(f).length - 1, 1, `P3c contiene exactamente una vez: ${f}`);
      assert.ok(migracion.includes(f), `F4 busca: ${f}`);
    }
    assert.ok(!/\bdelete\s+from\b/i.test(migracion.replace(/--.*$/gm, '')), 'F4 no borra datos');
    assert.ok(!/\bdrop\s+table\b|\btruncate\b/i.test(migracion), 'F4 no elimina tablas ni las vacía');
    const f4cTxt = sql(F4C);
    assert.ok(!/\bdelete\s+from\b|\bdrop\s+(table|trigger|policy|function)\b|\btruncate\b/i.test(f4cTxt.replace(/--.*$/gm, '')), 'F4c no borra ni elimina nada');
    for (const f of [
      'v_rpc jsonb;',
      "      v_rpc:=public.abc_catalogo_guardar_productos(\n        p_operation_id||'.'||v_grupo_n,v_grupo.empresa_id,\n        v_grupo.local_id,'EUR',v_grupo.productos\n      );",
      "'catalogo_ya_sincronizado',true,",
    ]) {
      assert.equal(p3c.split(f).length - 1, 1, `P3c contiene exactamente una vez el fragmento que F4c sustituye: ${f.slice(0, 40)}`);
      assert.ok(f4cTxt.includes(f), `F4c busca: ${f.slice(0, 40)}`);
    }
    const f4dTxt = sql(F4D).replace(/--.*$/gm, '');
    assert.ok(!/\bdelete\s+from\b|\bdrop\b|\btruncate\b|\balter\s+table\b|\binsert\s+into\b|\bupdate\s+public\./i.test(f4dTxt), 'F4d no borra, no elimina, no altera tablas y no escribe datos');
    assert.equal((f4dTxt.match(/create or replace function/gi) || []).length, 3, 'F4d redefine exactamente tres funciones');
    const f4bTxt = sql(F4B);
    assert.ok(!/\bdelete\s+from\b|\bdrop\s+(table|trigger|policy|function)\b|\btruncate\b/i.test(f4bTxt.replace(/--.*$/gm, '')), 'F4b no borra ni elimina nada');
    assert.ok(/on conflict \(empresa_id, key\) do nothing/.test(f4bTxt), 'F4b nunca pisa una fila existente');
  }

  // === 1. Forma «qa» =========================================================================================
  await montarEsquema('qa');
  await datosBase('qa');
  assert.equal(await pkDe(), 'PRIMARY KEY (key)');
  assert.deepEqual(await politicas(), ['pm05_almacen_delete', 'pm05_almacen_insert', 'pm05_almacen_select', 'pm05_almacen_update']);

  // Antes de F4: dos empresas no pueden tener la misma clave (el problema real).
  await fallo(admin.query("insert into public.almacen_kv(key, value, empresa_id) values ('productos', $1::jsonb, 'E-B')", [JSON.stringify(PRODUCTOS_B)]), { code: '23505' }, 'antes de F4 la clave es única en toda la tabla');

  const defRpcAntes = await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
  const defMirrorAntes = await defFuncion('public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)');
  assert.ok(defRpcAntes.includes("from public.almacen_kv k where k.key='productos' for update;"));
  assert.ok(defMirrorAntes.includes("where key='productos';"));

  await admin.query(migracion);

  assert.equal(await pkDe(), 'PRIMARY KEY (empresa_id, key)', 'clave primaria (empresa_id, key)');
  assert.deepEqual(await politicas(), ['plataforma_kv_delete', 'plataforma_kv_insert', 'plataforma_kv_select', 'plataforma_kv_update'], 'solo las cuatro políticas nuevas');
  assert.equal((await admin.query("select is_nullable n from information_schema.columns where table_name='almacen_kv' and column_name='empresa_id'")).rows[0].n, 'NO', 'empresa_id obligatorio');
  assert.equal(await n("select count(*)::int n from public.almacen_kv where empresa_id='__sin_empresa__'"), 3, 'las 3 filas sin empresa se conservan con la empresa ficticia');
  assert.equal(await n('select count(*)::int n from public.almacen_kv where empresa_id is null'), 0);
  assert.deepEqual((await admin.query("select key from public.almacen_kv where empresa_id='__sin_empresa__' order by key")).rows.map((r) => r.key), ['qa_pm04:bootstrap_done', 'qa_pm04:manifest', 'qa_pm04:resultado_baseline']);

  if (process.env.P09_HUELLAS === '1') {
    // Huellas para comparar con QA tras aplicar la migración allí (solo informativo).
    const hs = await admin.query(`
      select p.oid::regprocedure::text fn, md5(pg_get_functiondef(p.oid)) h, length(pg_get_functiondef(p.oid)) n
        from pg_proc p
       where p.proname in ('plataforma_kv_rol_puede','plataforma_kv_permitido','plataforma_kv_empresa_llamante','plataforma_f4_kv_empresa','abc_productos_guardar_lista','abc_catalogo_guardar_productos')
       order by 1`);
    for (const r of hs.rows) console.log('HUELLA', r.fn, r.h, r.n);
    const pol = await admin.query("select polname, polcmd, md5(coalesce(pg_get_expr(polqual, polrelid),'-')||'|'||coalesce(pg_get_expr(polwithcheck, polrelid),'-')) h from pg_policy where polrelid='public.almacen_kv'::regclass order by 1");
    for (const r of pol.rows) console.log('HUELLA_POLITICA', r.polname, r.polcmd, r.h);
  }

  // Idempotente: aplicar otra vez no cambia nada ni falla.
  {
    const antes = JSON.stringify((await admin.query('select * from public.almacen_kv order by empresa_id, key')).rows);
    const defR = await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
    await admin.query(migracion);
    assert.equal(JSON.stringify((await admin.query('select * from public.almacen_kv order by empresa_id, key')).rows), antes, 're-aplicar no cambia los datos');
    assert.equal(await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)'), defR, 're-aplicar no cambia la función');
    assert.equal(await pkDe(), 'PRIMARY KEY (empresa_id, key)');
    assert.equal((await politicas()).length, 4);
  }

  // Funciones del servidor parcheadas: ya no hay sentencias sin filtro de empresa.
  {
    const r = await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
    assert.ok(r.includes("private.plataforma_kv_empresa_llamante('productos')"));
    assert.ok(r.includes("k.empresa_id=v_lista_empresa for update;"));
    assert.ok(r.includes("where key='productos' and empresa_id=v_lista_empresa;"));
    assert.ok(r.includes("where k.key='productos' and k.empresa_id=v_lista_empresa;"));
    assert.ok(!/k\.key='productos' for update/.test(r) && !/where key='productos';/.test(r), 'ninguna sentencia de la RPC queda sin filtro de empresa');
    const m = await defFuncion('public.abc_catalogo_guardar_productos(text,text,text,text,jsonb)');
    assert.ok(m.includes("where key='productos' and empresa_id=p_empresa_id;"));
    assert.ok(!m.includes("where key='productos';"));
  }

  // La API de datos no ve la empresa ficticia ni ejecuta las ayudas privadas por su cuenta.
  const cAOwn = await como(A_OWN), cAEnc = await como(A_ENC), cACaj = await como(A_CAJ), cACam = await como(A_CAM), cAChu = await como(A_CHU);
  const cBOwn = await como(B_OWN), cMulti = await como(MULTI), cNadie = await como(NADIE), cAdminP = await como(ADMINP);
  const cInact = await como(INACTIVO);
  const cAnon = await como('', 'anon');
  for (const [nombre, c] of [['A_OWN', cAOwn], ['B_OWN', cBOwn], ['MULTI', cMulti], ['NADIE', cNadie], ['ADMINP', cAdminP]]) {
    assert.equal((await c.query("select count(*)::int n from public.almacen_kv where empresa_id='__sin_empresa__'")).rows[0].n, 0, `${nombre} no ve las filas sin empresa`);
  }
  await fallo(cAnon.query('select * from public.almacen_kv'), { code: '42501' }, 'anon no lee almacen_kv');
  await fallo(cAnon.query("select private.plataforma_kv_empresa_llamante('productos')"), { code: '42501' }, 'anon no ejecuta ayudas privadas');
  await fallo(cAOwn.query("select private.plataforma_kv_empresa_llamante('productos')"), { code: '42501' }, 'authenticated no ejecuta empresa_llamante');
  await fallo(cAOwn.query('select private.plataforma_f4_kv_empresa()'), { code: '42501' }, 'authenticated no ejecuta el disparador');

  // === 2. Dos empresas, la misma clave ========================================================================
  {
    await upsertKv(cAOwn, 'empleados', [{ id: 'e1', nombre: 'Ana' }]);
    await upsertKv(cBOwn, 'empleados', [{ id: 'e9', nombre: 'Berta' }]);
    const filas = (await admin.query("select empresa_id, value from public.almacen_kv where key='empleados' order by empresa_id")).rows;
    assert.equal(filas.length, 2, 'cada empresa tiene su propia fila `empleados`');
    assert.deepEqual(filas.map((f) => f.empresa_id), ['E-A', 'E-B']);
    assert.equal(filas[0].value[0].id, 'e1');
    assert.equal(filas[1].value[0].id, 'e9');

    // Cada una ve solo la suya.
    assert.deepEqual((await leer(cAOwn, 'empleados')).map((f) => f.empresa_id), ['E-A']);
    assert.deepEqual((await leer(cBOwn, 'empleados')).map((f) => f.empresa_id), ['E-B']);
    assert.equal((await leer(cNadie, 'empleados')).length, 0, 'una cuenta sin membresía no ve nada');
    assert.equal((await leer(cAdminP, 'empleados')).length, 0, 'el administrador de plataforma no es miembro: no ve datos de empresa');

    // Reescribir (conflicto): actualiza la propia fila y no toca la ajena.
    await upsertKv(cAOwn, 'empleados', [{ id: 'e1', nombre: 'Ana María' }, { id: 'e2', nombre: 'Luis' }]);
    assert.equal((await leer(cAOwn, 'empleados'))[0].value.length, 2);
    assert.equal((await leer(cBOwn, 'empleados'))[0].value.length, 1, 'la fila de B no cambia cuando A guarda');
    assert.equal(await n("select count(*)::int n from public.almacen_kv where key='empleados'"), 2, 'sigue habiendo una fila por empresa');

    // Un guardado de B tampoco pisa a A.
    await upsertKv(cBOwn, 'empleados', [{ id: 'e9', nombre: 'Berta Z' }]);
    assert.equal((await leer(cAOwn, 'empleados'))[0].value[0].nombre, 'Ana María');
    assert.equal((await leer(cBOwn, 'empleados'))[0].value[0].nombre, 'Berta Z');
  }

  // === 3. Un usuario no puede salir de su empresa ==================================================================
  {
    await fallo(cAOwn.query("insert into public.almacen_kv(empresa_id, key, value) values ('E-B','empleados','[]')"), { code: '42501' }, 'insertar con la empresa ajena');
    await fallo(cAOwn.query("insert into public.almacen_kv(empresa_id, key, value) values ('__sin_empresa__','temaOscuro','true')"), { code: '42501' }, 'insertar en la empresa ficticia');
    // UPDATE sin filtro: solo alcanza su fila.
    const u = await cAOwn.query("update public.almacen_kv set value='[]'::jsonb where key='empleados'");
    assert.equal(u.rowCount, 1, 'un UPDATE por clave solo alcanza la fila de la propia empresa');
    assert.equal((await leer(cBOwn, 'empleados'))[0].value[0].nombre, 'Berta Z', 'la fila de B queda intacta');
    await upsertKv(cAOwn, 'empleados', [{ id: 'e1', nombre: 'Ana' }]);
    // La empresa de una fila no se cambia desde la API (ni a una empresa donde también se es miembro).
    await fallo(cMulti.query("update public.almacen_kv set empresa_id='E-B' where empresa_id='E-A' and key='empleados'"), { code: '42501', mensaje: 'almacen_kv_empresa_inmutable' }, 'cambiar empresa_id');
    await fallo(cAOwn.query(`update public.almacen_kv set value='{"empresaId":"E-B"}'::jsonb where key='empleados'`), { code: '42501' }, 'cambiar la empresa por el JSON');
    // DELETE: solo la propia, y solo Propietario.
    await upsertKv(cAOwn, 'historialRespaldos', [{ id: 'r1' }]);
    await upsertKv(cBOwn, 'historialRespaldos', [{ id: 'r9' }]);
    assert.equal((await cACaj.query("delete from public.almacen_kv where key='historialRespaldos'")).rowCount, 0, 'un Cajero/a no borra');
    assert.equal((await cAOwn.query("delete from public.almacen_kv where key='historialRespaldos'")).rowCount, 1, 'el Propietario borra solo la de su empresa');
    assert.equal((await leer(cBOwn, 'historialRespaldos')).length, 1, 'la de B sigue');
    // Solo el Propietario borra: quien puede escribir una clave no puede por eso borrarla.
    await upsertKv(cACaj, 'arqueos', [{ id: 'q1' }]);
    await upsertKv(cAEnc, 'pedidos', [{ id: 'p1' }]);
    assert.equal((await cACaj.query("delete from public.almacen_kv where key='arqueos'")).rowCount, 0, 'Cajero/a escribe arqueos pero no los borra');
    assert.equal((await cAEnc.query("delete from public.almacen_kv where key='pedidos'")).rowCount, 0, 'Encargado escribe pedidos pero no los borra');
    assert.equal((await cAOwn.query("delete from public.almacen_kv where key='pedidos'")).rowCount, 1, 'el Propietario sí');
    // Un perfil desactivado, aunque conserve la membresía, no ve ni escribe nada.
    assert.equal((await leer(cInact, 'empleados')).length, 0, 'perfil inactivo: no lee');
    await fallo(upsertKv(cInact, 'temaOscuro', true), { code: '42501' }, 'perfil inactivo: no escribe');
    // Un borrado por clave de otro rol o de otra empresa no alcanza nada.
    assert.equal((await cBOwn.query("delete from public.almacen_kv where key='empleados' and empresa_id='E-A'")).rowCount, 0, 'B no ve (ni borra) lo de A');
    assert.equal(await n("select count(*)::int n from public.almacen_kv where empresa_id='E-A' and key='empleados'"), 1);
  }

  // === 4. Rol de la persona EN su empresa ==========================================================================
  {
    const escribe = async (c, key) => { await upsertKv(c, key, [{ id: 'x' }]); };
    const rechaza = (c, key, etq) => fallo(escribe(c, key), { code: '42501' }, etq);
    // Cualquier perfil activo de la empresa.
    for (const [nom, c] of [['Camarero/a', cACam], ['Cajero/a', cACaj], ['Churrero/a', cAChu], ['Encargado', cAEnc], ['Propietario', cAOwn]]) {
      await upsertKv(c, 'temaOscuro', true);
      assert.equal((await leer(c, 'temaOscuro')).length, 1, `${nom} lee y escribe temaOscuro de su empresa`);
    }
    await rechaza(cACam, 'empleados', 'Camarero/a no escribe empleados');
    await rechaza(cACam, 'nominas', 'Camarero/a no escribe nominas');
    await rechaza(cACam, 'pedidos', 'Camarero/a no escribe pedidos');
    await rechaza(cACaj, 'pedidos', 'Cajero/a no escribe pedidos');
    await escribe(cACaj, 'arqueos');
    await escribe(cAChu, 'pedidos');
    await rechaza(cAChu, 'arqueos', 'Churrero/a no escribe arqueos');
    await escribe(cAEnc, 'pedidos');
    await rechaza(cAEnc, 'nominas', 'Encargado no escribe nominas (solo Propietario)');
    await rechaza(cAEnc, 'empleados', 'Encargado no escribe empleados');
    await escribe(cAOwn, 'nominas');
    // Lectura con el mismo criterio.
    assert.equal((await leer(cACam, 'nominas')).length, 0, 'Camarero/a no lee nominas');
    assert.equal((await leer(cAEnc, 'nominas')).length, 0, 'Encargado no lee nominas');
    assert.equal((await leer(cAOwn, 'nominas')).length, 1);
    assert.equal((await leer(cACaj, 'arqueos')).length, 1, 'Cajero/a lee arqueos');
    // Claves fuera de la tabla: rechazadas para todos, como hoy en producción.
    await rechaza(cAOwn, 'empresas', 'empresas queda solo en el equipo');
    await rechaza(cAOwn, 'configEmpresa', 'configEmpresa queda solo en el equipo');
    await rechaza(cAOwn, 'clave_inventada', 'una clave desconocida se rechaza');
  }

  // === 5. Empresa ambigua o desconocida: falla cerrado =============================================================
  {
    await fallo(upsertKv(cMulti, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'dos empresas y sin empresa en la fila');
    await fallo(upsertKv(cNadie, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'sin membresía');
    await fallo(upsertKv(cAdminP, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'el administrador de plataforma no escribe colecciones de empresa');
    // Con empresa explícita (o dentro del JSON) sí.
    await cMulti.query("insert into public.almacen_kv(empresa_id, key, value) values ('E-B','locales','[]') on conflict (empresa_id, key) do update set value=excluded.value");
    await cMulti.query(`insert into public.almacen_kv(key, value) values ('locales', '{"empresaId":"E-A","id":"L-A1"}') on conflict (empresa_id, key) do update set value=excluded.value`);
    assert.equal((await admin.query("select value->>'id' v from public.almacen_kv where empresa_id='E-A' and key='locales'")).rows[0].v, 'L-A1', 'el JSON con empresaId decide la empresa');
    // Sin sesión de usuario (servicio): no inventa empresa; la deja a NOT NULL.
    await fallo(admin.query("insert into public.almacen_kv(key, value) values ('pedidos', '[]')"), { code: '23502' }, 'servicio sin empresa');
  }

  // === 6. La lista `productos` y las funciones del servidor ==========================================================
  {
    await admin.query("insert into public.almacen_kv(key, value, empresa_id) values ('productos', $1::jsonb, 'E-B')", [JSON.stringify(PRODUCTOS_B)]);
    // Escritura directa de la lista: sigue bloqueada para la API (es de la RPC).
    await fallo(cAOwn.query(`update public.almacen_kv set value='[]'::jsonb where key='productos'`), { code: '42501', mensaje: 'abc_productos_escritura_directa_bloqueada' }, 'productos directo');
    const lista = (c, base, nuevo, op) => c.query('select public.abc_productos_guardar_lista($1, $2::jsonb, $3::jsonb, $4::jsonb) r', [op, JSON.stringify(base), JSON.stringify(nuevo), '[]']);
    // A guarda su lista: B no cambia.
    const nuevoA = [{ ...PRODUCTOS_A[0], stock: 6 }];
    const rA = (await lista(cAOwn, PRODUCTOS_A, nuevoA, 'op-a-0001-abcdefgh')).rows[0].r;
    assert.equal(rA.ok, true);
    assert.equal(rA.lista_confirmada[0].stock, 6, 'la lista confirmada es la de A');
    assert.equal(rA.lista_confirmada[0].nombre, 'Pan A');
    const pA = (await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].value;
    const pB = (await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-B'")).rows[0].value;
    assert.equal(pA[0].stock, 6, 'A: stock actualizado');
    assert.equal(pB[0].stock, 9, 'B: intacta');
    assert.equal(pB[0].nombre, 'Pan B');
    // B guarda la suya (mismo id de producto P1): A no cambia.
    const rB = (await lista(cBOwn, PRODUCTOS_B, [{ ...PRODUCTOS_B[0], stock: 10 }], 'op-b-0001-abcdefgh')).rows[0].r;
    assert.equal(rB.lista_confirmada[0].nombre, 'Pan B');
    assert.equal((await admin.query("select value->0->>'stock' s from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].s, '6', 'A intacta tras guardar B');
    assert.equal((await admin.query("select value->0->>'stock' s from public.almacen_kv where key='productos' and empresa_id='E-B'")).rows[0].s, '10');
    // Una cuenta con las dos empresas: la RPC se niega (no sabe a cuál se refiere).
    await fallo(lista(cMulti, PRODUCTOS_A, PRODUCTOS_A, 'op-m-0001-abcdefgh'), { code: '42501', mensaje: 'almacen_kv_empresa_ambigua' }, 'RPC con empresa ambigua');
    // Sin lista en su empresa: ausente (no cae en la de otra).
    await fallo(lista(await como(N_OWN), PRODUCTOS_A, PRODUCTOS_A, 'op-n-0001-abcdefgh'), { mensaje: 'abc_productos_lista_nube_ausente' }, 'empresa sin lista');
    // Sin sesión.
    await fallo(lista(cNadie, PRODUCTOS_A, PRODUCTOS_A, 'op-x-0001-abcdefgh'), { mensaje: 'abc_productos_lista_nube_ausente' }, 'cuenta sin empresa');
    // --- F4b: cada empresa nace con su lista de productos vacía --------------------------------------
    {
      const antesA = JSON.stringify((await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows);
      const antesB = JSON.stringify((await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-B'")).rows);
      // Una empresa que ya tiene su fila antes de que exista la fila de empresa no se pisa.
      await admin.query("insert into public.almacen_kv(empresa_id, key, value) values ('E-PREVIA','productos','[{\"id\":\"X1\"}]')");
      await admin.query(sql(F4B));
      assert.equal(JSON.stringify((await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows), antesA, 'F4b no toca la lista de A');
      assert.equal(JSON.stringify((await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-B'")).rows), antesB, 'F4b no toca la lista de B');
      assert.equal((await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-NEW'")).rows[0].value.length, 0, 'relleno: la empresa existente sin lista recibe una lista vacía');
      await admin.query("insert into public.empresas(id, nombre) values ('E-FRESCA','Fresca')");
      assert.deepEqual((await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-FRESCA'")).rows.map((r) => r.value), [[]], 'una empresa nueva nace con su lista vacía');
      await admin.query("insert into public.almacen_kv(empresa_id, key, value) values ('E-PREVIA2','productos','[{\"id\":\"X2\"}]')");
      await admin.query("insert into public.empresas(id, nombre) values ('E-PREVIA2','Con lista previa')");
      assert.equal((await admin.query("select value->0->>'id' i from public.almacen_kv where key='productos' and empresa_id='E-PREVIA2'")).rows[0].i, 'X2', 'el alta de empresa no pisa una lista que ya existía');
      await admin.query("update public.empresas set nombre='Fresca 2' where id='E-FRESCA'");
      assert.equal(await n("select count(*)::int n from public.almacen_kv where key='productos' and empresa_id='E-FRESCA'"), 1, 'actualizar la empresa no duplica nada');
      // Idempotente.
      const foto = JSON.stringify((await admin.query('select empresa_id, key, value from public.almacen_kv order by empresa_id, key')).rows);
      await admin.query(sql(F4B));
      assert.equal(JSON.stringify((await admin.query('select empresa_id, key, value from public.almacen_kv order by empresa_id, key')).rows), foto, 're-aplicar F4b no cambia nada');
      await fallo((await como(N_OWN)).query('select private.plataforma_f4b_lista_productos_inicial()'), { code: '42501' }, 'la API no ejecuta el disparador de F4b');
      // Ahora la empresa nueva guarda su lista de productos con la RPC (antes: lista ausente).
      const cN = await como(N_OWN);
      const prodN = [{ id: 'N1', empresaId: 'E-NEW', localId: 'L-N1', nombre: 'Café en grano', stock: 3 }];
      const rN = (await lista(cN, [], prodN, 'op-n-0002-abcdefgh')).rows[0].r;
      assert.equal(rN.ok, true);
      assert.equal(rN.lista_confirmada[0].nombre, 'Café en grano', 'la empresa nueva ya guarda su lista de productos');
      assert.equal((await admin.query("select value->0->>'id' i from public.almacen_kv where key='productos' and empresa_id='E-NEW'")).rows[0].i, 'N1');
      assert.equal((await admin.query("select value->0->>'stock' s from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].s, '6', 'y la lista de A sigue como estaba');
      // --- F4c: sin contexto fiscal la lista se guarda igualmente ---------------------------------------
      const prodVenta = { id: 'N2', empresaId: 'E-NEW', localId: 'L-N1', nombre: 'Leche', unidad: 'ud', fraccionable: false, precioVenta: 2, ivaVenta: 10, activo: true, tipo: 'simple' };
      const conVenta = (c, base, nuevo, venta, op) => c.query('select public.abc_productos_guardar_lista($1, $2::jsonb, $3::jsonb, $4::jsonb) r', [op, JSON.stringify(base), JSON.stringify(nuevo), JSON.stringify(venta)]);
      const nLista = async (emp) => (await admin.query("select jsonb_array_length(value) n from public.almacen_kv where key='productos' and empresa_id=$1", [emp])).rows[0].n;
      const baseN = rN.lista_confirmada;
      await fallo(conVenta(cN, baseN, [...baseN, prodVenta], [prodVenta], 'op-n-0003-abcdefgh'), { mensaje: 'catalogo_contexto_fiscal_ausente' }, 'sin F4c la falta de contexto fiscal aborta también la lista');
      assert.equal(await nLista('E-NEW'), 1, 'y la lista de la empresa no cambia');
      await admin.query(sql(F4C));
      const rV = (await conVenta(cN, baseN, [...baseN, prodVenta], [prodVenta], 'op-n-0004-abcdefgh')).rows[0].r;
      assert.equal(rV.ok, true);
      assert.equal(rV.catalogo_ya_sincronizado, false, 'avisa de que el catálogo no se sincronizó');
      assert.equal(rV.catalogo_pendiente_contexto_fiscal, true);
      assert.equal(rV.lista_confirmada.length, 2);
      assert.equal(await nLista('E-NEW'), 2, 'con F4c la lista se guarda aunque falte el contexto fiscal');
      // Cualquier otro error del catálogo sigue abortando la transacción entera.
      const prodAmb = { ...prodVenta, id: 'N3', localId: 'L-AMB' };
      await fallo(conVenta(cN, rV.lista_confirmada, [...rV.lista_confirmada, prodAmb], [prodAmb], 'op-n-0005-abcdefgh'), { mensaje: 'catalogo_contexto_fiscal_ambiguo' }, 'el contexto fiscal ambiguo sigue siendo un error');
      assert.equal(await nLista('E-NEW'), 2, 'y no deja nada a medias');
      // Una empresa con catálogo operativo no nota nada: sigue sincronizado.
      {
        const listaA = (await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].value;
        const nuevoA = listaA.map((x) => ({ ...x, nombre: 'Pan A2' }));
        const rA2 = (await conVenta(cAOwn, listaA, nuevoA, [nuevoA[0]], 'op-a-0009-abcdefgh')).rows[0].r;
        assert.equal(rA2.catalogo_ya_sincronizado, true, 'con contexto fiscal el catálogo sigue sincronizándose');
        assert.equal(rA2.catalogo_pendiente_contexto_fiscal, false);
        assert.equal(rA2.lista_confirmada[0].nombre, 'Pan A2');
      }
      // Idempotente.
      const defC = await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
      await admin.query(sql(F4C));
      assert.equal(await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)'), defC, 're-aplicar F4c no cambia la función');
    }
    // El espejo P3b (abc_catalogo_guardar_productos): solo la fila de la empresa indicada.
    await cAOwn.query("select public.abc_catalogo_guardar_productos('op-m-1', 'E-A', 'L-A1', 'EUR', $1::jsonb)", [JSON.stringify([{ id: 'P1', precioVenta: 2 }])]);
    assert.equal((await admin.query("select value->0->>'precioVenta' s from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].s, '2');
    assert.equal((await admin.query("select value->0->>'precioVenta' s from public.almacen_kv where key='productos' and empresa_id='E-B'")).rows[0].s, '1', 'el espejo de A no toca la lista de B');
    await cBOwn.query("select public.abc_catalogo_guardar_productos('op-m-2', 'E-B', 'L-B1', 'EUR', $1::jsonb)", [JSON.stringify([{ id: 'P1', precioVenta: 3 }])]);
    assert.equal((await admin.query("select value->0->>'precioVenta' s from public.almacen_kv where key='productos' and empresa_id='E-B'")).rows[0].s, '3');
    assert.equal((await admin.query("select value->0->>'precioVenta' s from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].s, '2', 'y el de B no toca la de A');
    // El espejo de una cuenta que no gestiona esa empresa se rechaza antes de escribir nada.
    await fallo(cAOwn.query("select public.abc_catalogo_guardar_productos('op-m-3', 'E-B', 'L-B1', 'EUR', $1::jsonb)", [JSON.stringify([{ id: 'P1', precioVenta: 99 }])]), { mensaje: 'abc_catalogo_no_autorizado' }, 'A no escribe el catálogo de B');
  }

  // === 6b. F4d: una empresa dada de baja no cuenta para elegir la empresa de una cuenta ==============================
  {
    const OWNBAJA = U('a6'), SOLOBAJA = U('a7');
    await admin.query(`
      insert into auth.users(id) values ('${OWNBAJA}'),('${SOLOBAJA}');
      insert into public.perfiles(user_id, rol) values ('${OWNBAJA}','Propietario'),('${SOLOBAJA}','Propietario');`);
    // La baja de la plataforma desactiva también las membresías; el estado heredado (empresa inactiva con
    // membresía activa) es el que dejó a una cuenta de QA y a otra de producción en situación ambigua.
    await admin.query("insert into public.empresas(id, nombre, activo) values ('E-BAJA','Empresa dada de baja', false)"); // F4b le da su lista vacía
    await admin.query(`insert into public.membresias_usuario(id, user_id, empresa_id, local_id, todos_locales, rol) values
      (21,'${OWNBAJA}','E-A',null,true,'Propietario'),
      (22,'${OWNBAJA}','E-BAJA',null,true,'Propietario'),
      (23,'${SOLOBAJA}','E-BAJA',null,true,'Propietario')`);
    const cOB = await como(OWNBAJA), cSB = await como(SOLOBAJA);
    const listaDe = (c, op) => c.query('select public.abc_productos_guardar_lista($1, $2::jsonb, $3::jsonb, $4::jsonb) r', [op, JSON.stringify(PRODUCTOS_A), JSON.stringify(PRODUCTOS_A), '[]']);

    // Control: sin F4d la cuenta con una empresa viva y otra dada de baja queda ambigua.
    assert.deepEqual((await leer(cOB, 'productos')).map((f) => f.empresa_id), ['E-A', 'E-BAJA'], 'antes de F4d ve la lista de la empresa dada de baja');
    await fallo(upsertKv(cOB, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'antes de F4d: la empresa de baja hace ambigua la escritura');
    await fallo(listaDe(cOB, 'op-ob-0001-abcdefgh'), { code: '42501', mensaje: 'almacen_kv_empresa_ambigua' }, 'antes de F4d: la empresa de baja hace ambigua la RPC');

    const huellaDatos = async () => JSON.stringify((await admin.query('select empresa_id, key, value from public.almacen_kv order by empresa_id, key')).rows);
    const datosAntes = await huellaDatos();
    const D4 = sql(F4D);
    await admin.query(D4);
    assert.equal(await huellaDatos(), datosAntes, 'F4d no toca ningún dato');
    assert.equal(await pkDe(), 'PRIMARY KEY (empresa_id, key)');
    assert.deepEqual(await politicas(), ['plataforma_kv_delete', 'plataforma_kv_insert', 'plataforma_kv_select', 'plataforma_kv_update'], 'F4d no cambia las políticas');

    if (process.env.P09_HUELLAS === '1') {
      const hs = await admin.query(`
        select p.oid::regprocedure::text fn, md5(pg_get_functiondef(p.oid)) h, length(pg_get_functiondef(p.oid)) n
          from pg_proc p where p.proname in ('plataforma_kv_permitido','plataforma_kv_empresa_llamante','plataforma_f4_kv_empresa') order by 1`);
      for (const r of hs.rows) console.log('HUELLA_F4D', r.fn, r.h, r.n);
    }

    // Después: solo cuenta la empresa viva.
    assert.deepEqual((await leer(cOB, 'productos')).map((f) => f.empresa_id), ['E-A'], 'la empresa de baja deja de ser visible');
    await upsertKv(cOB, 'pedidos', [{ id: 'ob1' }]);
    assert.deepEqual((await admin.query("select empresa_id from public.almacen_kv where key='pedidos' and value->0->>'id'='ob1'")).rows.map((r) => r.empresa_id), ['E-A'], 'escribe en su única empresa viva');
    const listaA = (await admin.query("select value from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].value;
    const rOB = (await cOB.query('select public.abc_productos_guardar_lista($1, $2::jsonb, $3::jsonb, $4::jsonb) r', ['op-ob-0002-abcdefgh', JSON.stringify(listaA), JSON.stringify(listaA.map((x) => ({ ...x, stock: 77 }))), '[]'])).rows[0].r;
    assert.equal(rOB.ok, true, 'la RPC de la lista ya encuentra su empresa');
    assert.equal((await admin.query("select value->0->>'stock' s from public.almacen_kv where key='productos' and empresa_id='E-A'")).rows[0].s, '77');
    assert.equal((await admin.query("select jsonb_array_length(value) n from public.almacen_kv where key='productos' and empresa_id='E-BAJA'")).rows[0].n, 0, 'la lista de la empresa de baja sigue vacía e intacta');
    // No puede escribir ni borrar en la empresa dada de baja aunque lo pida expresamente.
    await fallo(cOB.query("insert into public.almacen_kv(empresa_id, key, value) values ('E-BAJA','locales','[]')"), { code: '42501' }, 'escribir en la empresa de baja');
    await fallo(upsertKv(cOB, 'locales', { empresaId: 'E-BAJA', id: 'L-BAJA' }), { code: '42501' }, 'escribir en la empresa de baja por el JSON');
    assert.equal((await cOB.query("delete from public.almacen_kv where empresa_id='E-BAJA'")).rowCount, 0, 'no borra nada de la empresa de baja');
    // Una cuenta cuya única membresía está en la empresa de baja: no ve, no escribe, no inventa empresa.
    assert.equal((await cSB.query("select count(*)::int n from public.almacen_kv")).rows[0].n, 0, 'sin ninguna empresa viva no ve nada');
    await fallo(upsertKv(cSB, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'sin ninguna empresa viva no escribe');
    // Dos empresas VIVAS siguen siendo ambiguas (una cuenta = una empresa): falla cerrado.
    await fallo(upsertKv(cMulti, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'dos empresas vivas: sigue fallando cerrado');
    await fallo(listaDe(cMulti, 'op-m-0002-abcdefgh'), { code: '42501', mensaje: 'almacen_kv_empresa_ambigua' }, 'dos empresas vivas: la RPC sigue negándose');
    // Quien no tiene nada que ver, igual que antes; los demás roles de A, igual que antes.
    assert.equal((await leer(cNadie, 'productos')).length, 0);
    await upsertKv(cAEnc, 'pedidos', [{ id: 'enc-f4d' }]);
    await fallo(upsertKv(cACaj, 'nominas', [{ id: 'x' }]), { code: '42501' }, 'la tabla de roles sigue igual');
    // Reactivar la empresa devuelve su visibilidad sin haber tocado sus datos (y vuelve la ambigüedad).
    await admin.query("update public.empresas set activo = true where id = 'E-BAJA'");
    assert.deepEqual((await leer(cOB, 'productos')).map((f) => f.empresa_id), ['E-A', 'E-BAJA'], 'reactivada: vuelve a ser visible');
    await fallo(upsertKv(cOB, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'reactivada: dos empresas vivas');
    await admin.query("update public.empresas set activo = false where id = 'E-BAJA'");
    // Idempotente y con los permisos de F4.
    const defs = async () => JSON.stringify([
      await defFuncion('private.plataforma_kv_permitido(text,text,text,text)'),
      await defFuncion('private.plataforma_kv_empresa_llamante(text)'),
      await defFuncion('private.plataforma_f4_kv_empresa()'),
    ]);
    const defsAntes = await defs();
    const datosMedio = await huellaDatos();
    await admin.query(D4);
    assert.equal(await defs(), defsAntes, 're-aplicar F4d no cambia las funciones');
    assert.equal(await huellaDatos(), datosMedio, 're-aplicar F4d no cambia los datos');
    await fallo(cOB.query("select private.plataforma_kv_empresa_llamante('productos')"), { code: '42501' }, 'F4d: authenticated sigue sin ejecutar empresa_llamante');
    await fallo(cOB.query('select private.plataforma_f4_kv_empresa()'), { code: '42501' }, 'F4d: authenticated sigue sin ejecutar el disparador');
    await fallo(cAnon.query("select private.plataforma_kv_permitido('E-A', null, 'productos', 'leer')"), { code: '42501' }, 'F4d: anon sigue sin ejecutar plataforma_kv_permitido');
  }

  // === 7. La migración se niega si encuentra algo que no conoce y no deja nada a medias =====================================
  {
    // 7.1 Política ajena en la tabla.
    await montarEsquema('qa', { politicaExtra: true });
    await datosBase('qa');
    await fallo(admin.query(migracion), { mensaje: 'PLATAFORMA_F4_POLITICA_DESCONOCIDA' }, 'política desconocida');
    await admin.query('rollback');
    assert.equal(await pkDe(), 'PRIMARY KEY (key)', 'abortada: la clave primaria sigue como estaba');
    assert.equal(await n('select count(*)::int n from public.almacen_kv where empresa_id is null'), 3, 'abortada: las filas sin empresa siguen sin tocar');
    assert.ok((await politicas()).includes('pm05_almacen_select'), 'abortada: las políticas antiguas siguen');

    // 7.2 La RPC existe pero su texto no es el esperado.
    const raro = `create or replace function public.abc_productos_guardar_lista(p_operation_id text, p_base jsonb, p_nuevo jsonb, p_venta jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;`;
    await montarEsquema('qa', { listaExtra: raro });
    await datosBase('qa');
    await fallo(admin.query(migracion), { mensaje: 'PLATAFORMA_F4_PARCHE_NO_APLICABLE:abc_productos_guardar_lista' }, 'texto de la RPC inesperado');
    await admin.query('rollback');
    assert.equal(await pkDe(), 'PRIMARY KEY (key)', 'abortada por la RPC: nada a medias');
    assert.equal(await n('select count(*)::int n from public.almacen_kv where empresa_id is null'), 3);
    assert.deepEqual(await politicas(), ['pm05_almacen_delete', 'pm05_almacen_insert', 'pm05_almacen_select', 'pm05_almacen_update']);

    // 7.2b F4c se niega si la función de P3c tiene un texto que no conoce y no deja nada a medias.
    await montarEsquema('qa');
    await datosBase('qa');
    await admin.query(migracion);
    await admin.query(sql(F4B));
    await admin.query(raro);
    const defRaro = await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)');
    await fallo(admin.query(sql(F4C)), { mensaje: 'PLATAFORMA_F4C_PARCHE_NO_APLICABLE:abc_productos_guardar_lista' }, 'F4c con texto de la RPC inesperado');
    await admin.query('rollback');
    assert.equal(await defFuncion('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)'), defRaro, 'F4c abortada: la función queda como estaba');

    // 7.2c F4d se niega si falta F4 o si empresas no tiene la columna activo, y no deja nada a medias.
    await montarEsquema('qa');
    await datosBase('qa');
    await fallo(admin.query(sql(F4D)), { mensaje: 'PLATAFORMA_F4D_PREVIO:falta_F4' }, 'F4d sin F4');
    await admin.query('rollback');
    await admin.query(migracion);
    const defPermAntes = await defFuncion('private.plataforma_kv_permitido(text,text,text,text)');
    await admin.query('alter table public.empresas drop column activo');
    await fallo(admin.query(sql(F4D)), { mensaje: 'PLATAFORMA_F4D_PREVIO:empresas_sin_columna_activo' }, 'F4d sin empresas.activo');
    await admin.query('rollback');
    assert.equal(await defFuncion('private.plataforma_kv_permitido(text,text,text,text)'), defPermAntes, 'F4d abortada: la función queda como estaba');

    // 7.3 Una empresa llamada como la ficticia.
    await montarEsquema('qa');
    await datosBase('qa');
    await admin.query("insert into public.empresas(id, nombre) values ('__sin_empresa__','x')");
    await fallo(admin.query(migracion), { mensaje: 'PLATAFORMA_F4_PREVIO:la_empresa_ficticia_ya_existe' }, 'empresa ficticia ya existe');
    await admin.query('rollback');
    assert.equal(await pkDe(), 'PRIMARY KEY (key)');
  }

  // === 8. Forma «prod»: sin disparadores ni funciones ABC, siete colecciones sin etiqueta =============================================
  {
    await montarEsquema('prod');
    await datosBase('prod');
    assert.equal(await n('select count(*)::int n from public.almacen_kv where empresa_id is null'), 7);
    await admin.query(migracion);
    assert.equal(await pkDe(), 'PRIMARY KEY (empresa_id, key)');
    assert.deepEqual(await politicas(), ['plataforma_kv_delete', 'plataforma_kv_insert', 'plataforma_kv_select', 'plataforma_kv_update'], 'las políticas «acceso por rol y clave» se sustituyen');
    await admin.query(sql(F4B));
    assert.equal(await n("select count(*)::int n from public.almacen_kv where key='productos' and empresa_id in ('E-A','E-B','E-NEW')"), 3, 'F4b también rellena en la forma de producción');
    await admin.query(sql(F4C)); // sin la función de P3c no hace nada
    assert.equal(await n("select count(*)::int n from public.almacen_kv where empresa_id='__sin_empresa__'"), 7, 'las siete colecciones de antes se conservan, etiquetadas');
    const cNew = await como(N_OWN), cA = await como(A_OWN), cB = await como(B_OWN);
    const vistaNueva = await leer(cNew, 'productos');
    assert.deepEqual(vistaNueva.map((f) => [f.empresa_id, f.value.length]), [['E-NEW', 0]], 'la empresa nueva solo ve su lista vacía: no hereda las colecciones de antes');
    // Sin funciones ABC en este entorno: la migración no las crea.
    assert.equal(await n("select count(*)::int n from pg_proc where proname in ('abc_productos_guardar_lista','abc_catalogo_guardar_productos')"), 0);
    // Y sin el disparador de «productos solo por RPC» la empresa nueva sí escribe su lista.
    await upsertKv(cNew, 'productos', [{ id: 'N1', nombre: 'Café' }]);
    await upsertKv(cA, 'productos', [{ id: 'A1', nombre: 'Pan' }]);
    await upsertKv(cB, 'productos', [{ id: 'B1', nombre: 'Leche' }]);
    for (const [c, id] of [[cNew, 'N1'], [cA, 'A1'], [cB, 'B1']]) {
      const f = await leer(c, 'productos');
      assert.equal(f.length, 1, 'cada empresa ve una sola lista');
      assert.equal(f[0].value[0].id, id);
    }
    assert.equal(await n("select count(*)::int n from public.almacen_kv where key='productos'"), 4, 'tres de empresas más la de antes (ficticia)');
    // Sin pm05 en este entorno, la empresa dentro del JSON la resuelve el disparador de F4.
    const cMulti = await como(MULTI);
    await cMulti.query(`insert into public.almacen_kv(key, value) values ('locales', '{"empresaId":"E-A","id":"L-A1"}')`);
    assert.equal(await n("select count(*)::int n from public.almacen_kv where empresa_id='E-A' and key='locales'"), 1, 'el JSON con empresaId etiqueta la fila');
    await fallo(cMulti.query(`insert into public.almacen_kv(key, value) values ('pedidos', '[]')`), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'sin empresa y con dos empresas');
    // Los datos de antes siguen ilegibles para cualquier cuenta.
    assert.equal((await cA.query("select count(*)::int n from public.almacen_kv where empresa_id='__sin_empresa__'")).rows[0].n, 0);

    // F4d con la situación real de producción: tres empresas, una sola activa, y una cuenta con membresía
    // activa en las tres (las otras dos están dadas de baja).
    const PROD1 = U('a8');
    await admin.query(`
      insert into auth.users(id) values ('${PROD1}');
      insert into public.perfiles(user_id, rol) values ('${PROD1}','Propietario');
      update public.empresas set activo = false where id in ('E-B','E-NEW');
      insert into public.membresias_usuario(id, user_id, empresa_id, local_id, todos_locales, rol) values
        (31,'${PROD1}','E-A',null,true,'Propietario'),(32,'${PROD1}','E-B',null,true,'Propietario'),(33,'${PROD1}','E-NEW',null,true,'Propietario')`);
    const cP1 = await como(PROD1);
    await fallo(upsertKv(cP1, 'pedidos', []), { code: '42501', mensaje: 'almacen_kv_empresa_no_determinada' }, 'prod sin F4d: tres membresías activas');
    await admin.query(sql(F4D));
    await upsertKv(cP1, 'pedidos', [{ id: 'p1' }]);
    assert.deepEqual((await admin.query("select empresa_id from public.almacen_kv where key='pedidos' and value->0->>'id'='p1'")).rows.map((r) => r.empresa_id), ['E-A'], 'prod con F4d: guarda en la única empresa activa');
    assert.deepEqual((await leer(cP1, 'productos')).map((f) => f.empresa_id), ['E-A'], 'prod con F4d: solo ve la lista de su empresa activa');
  }

  console.log('PLATAFORMA_P09_COLECCIONES_POR_EMPRESA=PASS');
} finally {
  for (const c of clientes) { try { await c.end(); } catch { /* ya cerrado */ } }
  try { await admin.end(); } catch { /* ya cerrado */ }
}

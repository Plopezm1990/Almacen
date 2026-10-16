import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url);
const ORIGIN = 'https://deploy-preview-150--chic-entremet-9107cf.netlify.app';

function installFunction(relativePath, options = {}) {
  let handler;
  const calls = { create: 0, finalize: 0, delete: 0, ban: 0, errors: [] };
  const actor = { id: 'owner-qa' };
  const existing = options.existing || null;
  const admin = {
    rpc: async (name) => {
      if (name === 'pm11_preparar_cuenta_empleado') {
        return { data: { ok: true, empleado: { empresa_id: 'QA-EMP-A', local_id: 'QA-A1' }, cuenta: existing }, error: null };
      }
      assert.equal(name, 'pm11_finalizar_creacion_cuenta_empleado');
      calls.finalize += 1;
      if (options.finalizeThrows) throw new Error('network lost after Auth creation');
      if (options.finalizeFails) return { data: null, error: { message: 'finalization failed' } };
      return { data: { ok: true, yaCreada: false }, error: null };
    },
    auth: { admin: {
      createUser: async () => {
        calls.create += 1;
        if (options.emailOccupied || (options.duplicateAfterFirst && calls.create > 1)) {
          return { data: null, error: { message: 'User already registered' } };
        }
        return { data: { user: { id: 'new-auth-user' } }, error: null };
      },
      deleteUser: async (userId) => {
        assert.equal(userId, 'new-auth-user');
        calls.delete += 1;
        if (options.deleteThrows) throw new Error('delete unavailable');
        return { error: options.deleteFails ? { message: 'delete failed' } : null };
      },
      updateUserById: async (userId, attributes) => {
        assert.equal(userId, 'new-auth-user');
        assert.equal(attributes.ban_duration, '876000h');
        calls.ban += 1;
        return options.banFails
          ? { data: null, error: { message: 'ban failed' } }
          : { data: { user: { banned_until: '2126-01-01T00:00:00.000Z' } }, error: null };
      }
    } }
  };
  const caller = { auth: { getUser: async () => ({ data: { user: actor }, error: null }) } };
  const raw = fs.readFileSync(new URL(relativePath, ROOT), 'utf8');
  // El gate general usa Node 20; este archivo Edge solo tiene anotaciones
  // de parámetros, que se eliminan sin depender de un runtime TypeScript.
  const code = raw
    .replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";\s*/u, '')
    .replace(/:\s*(?:string|Request|unknown|number|ReturnType<typeof createClient>)(?=\s*[,)=])/gu, '');
  const context = {
    createClient: (_url, key) => key === 'service-role' ? admin : caller,
    Deno: {
      env: { get: (name) => ({ SUPABASE_URL: 'https://qa.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-role' })[name] },
      serve: (fn) => { handler = fn; }
    },
    Response,
    URL,
    Date,
    console: { error: (...args) => calls.errors.push(args) }
  };
  vm.runInNewContext(code, context, { filename: relativePath });
  assert.equal(typeof handler, 'function');
  return { handler, calls };
}

async function invoke(handler) {
  const request = new Request(`${ORIGIN}/functions/v1/qa-crear-empleado`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: 'Bearer qa-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ empleadoId: 'employee-qa', nombre: 'Empleado QA', email: 'employee@qa.invalid', password: 'test-password', rol: 'Camarero/a' })
  });
  const response = await handler(request);
  return { status: response.status, body: await response.json() };
}

for (const path of ['supabase/functions/crear-cuenta-empleado/index.ts', 'supabase/functions/qa-crear-empleado/index.ts']) {
  {
    const { handler, calls } = installFunction(path);
    const result = await invoke(handler);
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(calls.create, 1);
    assert.equal(calls.finalize, 1);
    assert.equal(calls.delete, 0);
  }
  {
    const { handler, calls } = installFunction(path, { existing: { userId: 'existing-auth', email: 'employee@qa.invalid', activo: true, rol: 'Camarero/a' } });
    const result = await invoke(handler);
    assert.equal(result.body.yaCreada, true);
    assert.equal(calls.create, 0);
  }
  {
    const { handler, calls } = installFunction(path, { emailOccupied: true });
    const result = await invoke(handler);
    assert.equal(result.status, 409);
    assert.equal(calls.finalize, 0);
    assert.equal(calls.delete, 0);
  }
  {
    const { handler, calls } = installFunction(path, { duplicateAfterFirst: true });
    const results = await Promise.all([invoke(handler), invoke(handler)]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(calls.create, 2);
    assert.equal(calls.finalize, 1, 'dos solicitudes simultáneas con el mismo correo no duplican el vínculo');
  }
  for (const failure of [{ finalizeFails: true }, { finalizeThrows: true }]) {
    const { handler, calls } = installFunction(path, failure);
    const result = await invoke(handler);
    assert.equal(result.body.ok, false);
    assert.equal(calls.delete, 1, 'todo fallo posterior a createUser debe neutralizar la nueva identidad');
    assert.equal(calls.ban, 0);
  }
  {
    const { handler, calls } = installFunction(path, { finalizeFails: true, deleteThrows: true });
    const result = await invoke(handler);
    assert.equal(result.status, 500);
    assert.equal(calls.delete, 1);
    assert.equal(calls.ban, 1);
    assert.match(result.body.error, /bloqueada/);
  }
  {
    const { handler, calls } = installFunction(path, { finalizeFails: true, deleteFails: true, banFails: true });
    const result = await invoke(handler);
    assert.equal(result.status, 500);
    assert.equal(calls.delete, 1);
    assert.equal(calls.ban, 1);
    assert.match(result.body.error, /requiere revisión de seguridad/);
    assert.equal(calls.errors.length, 1);
  }
}

console.log('P11_CREATE_ACCOUNT_BEHAVIOR=PASS');

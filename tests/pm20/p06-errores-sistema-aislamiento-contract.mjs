import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM20 P06: "Respaldos, errores y auditoría: destino, trazabilidad, diagnóstico y
// recuperación demostrables". Defecto real encontrado y corregido: la tabla
// errores_sistema (Supabase QA) no tenía aislamiento por empresa -- su política previa
// (qa_errores_authenticated) era USING(true)/WITH CHECK(true) para todos los comandos,
// y el frontend nunca enviaba empresa_id/local_id al registrar un error ni al leerlos.
// Cualquier usuario autenticado de CUALQUIER empresa podía leer el historial de errores
// (mensajes, pila de llamadas, dispositivo) de TODAS las demás empresas del proyecto.
//
// Corrección aplicada en Supabase QA (qjqorixtkilwsndqayyx), migración
// pm20_p06_errores_sistema_aislamiento: nuevas columnas empresa_id/local_id; política
// permisiva sustituida por el mismo patrón ya establecido en
// auditoria_registro/clientes_empresa/proveedores_empresa (SELECT restringido a
// Propietario de la empresa dueña de la fila; INSERT solo permite empresa_id propio o
// null). fuente.js actualizado para enviar ese contexto en cada inserción.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- 1. Migración trackeada en el repo (no solo aplicada en el proyecto). ----
{
  const path = 'supabase/migrations/20260908180500_pm20_p06_errores_sistema_aislamiento.sql';
  assert.ok(fs.existsSync(path), 'la migración debe estar trackeada en supabase/migrations');
  const sql = fs.readFileSync(path, 'utf8');
  assert.match(sql, /alter table public\.errores_sistema/);
  assert.match(sql, /drop policy if exists qa_errores_authenticated/);
  assert.match(sql, /create policy errores_sistema_select/);
  assert.match(sql, /private\.la_rol\(\) = 'Propietario'/);
  assert.match(sql, /create policy errores_sistema_insert/);
  console.log('P06_PM20_MIGRACION_TRACKEADA=PASS');
}

// ---- 2. Contexto expuesto globalmente (mismo patrón ya establecido para
// window.__usuarioActivoNombre) -- necesario porque el error handler global vive fuera
// del árbol de React y no tiene acceso directo a empresaDelLocalActivo/localActivoId. ----
{
  assert.match(src, /window\.__contextoErroresPM20 = \{ empresaId: empresaDelLocalActivo\?\.id \|\| null, localId: localActivoId \|\| null \};/, 'debe existir el efecto que expone el contexto activo para el registro de errores');
  console.log('P06_PM20_CONTEXTO_GLOBAL_EXPUESTO=PASS');
}

// ---- 3. Comportamiento real: registrarErrorSistema envía empresa_id/local_id del
// contexto activo, y usa null cuando no hay contexto todavía (arranque/login) --
// nunca deja de registrar el error, solo dejará de ser visible sin empresa. ----
{
  const ini = src.indexOf('async function registrarErrorSistema(');
  const fin = src.indexOf('if (typeof window !== "undefined") {\n  window.addEventListener("error"', ini);
  assert.ok(ini >= 0 && fin > ini, 'no se pudo acotar registrarErrorSistema');
  const codigo = src.slice(ini, fin);
  assert.match(codigo, /empresa_id: contexto\.empresaId \|\| null/, 'debe enviar empresa_id del contexto activo');
  assert.match(codigo, /local_id: contexto\.localId \|\| null/, 'debe enviar local_id del contexto activo');

  let insertPayload = null;
  const ctx = {
    console,
    crypto: { randomUUID: () => 'id-test' },
    navigator: { userAgent: 'agente-de-prueba' },
    ultimosErroresAvisados: new Map(),
    fetch: async () => ({ ok: true }),
  };
  ctx.window = {
    __nubeActiva: true,
    getSupabaseClient: async () => ({
      from: (tabla) => ({
        insert: async (payload) => { if (tabla === 'errores_sistema') insertPayload = payload; return { error: null }; }
      })
    }),
    __contextoErroresPM20: { empresaId: 'e1', localId: 'l1' }
  };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  await ctx.registrarErrorSistema('fallo de prueba', 'pantalla-x', 'pila-x');
  assert.ok(insertPayload, 'debe intentar insertar el error');
  assert.equal(insertPayload.empresa_id, 'e1', 'debe enviar el empresa_id del contexto activo');
  assert.equal(insertPayload.local_id, 'l1', 'debe enviar el local_id del contexto activo');
  console.log('P06_PM20_REGISTRAR_ERROR_CON_CONTEXTO=PASS');

  // Sin contexto activo (arranque/login): sigue registrando el error, con empresa_id null.
  insertPayload = null;
  ctx.window.__contextoErroresPM20 = undefined;
  await ctx.registrarErrorSistema('fallo antes de elegir empresa', 'arranque', null);
  assert.ok(insertPayload, 'debe seguir registrando el error aunque no haya contexto todavía');
  assert.equal(insertPayload.empresa_id, null, 'sin contexto activo, empresa_id debe ser null (no se pierde el registro, solo queda sin visibilidad por RLS)');
  console.log('P06_PM20_REGISTRAR_ERROR_SIN_CONTEXTO_NO_SE_PIERDE=PASS');
}

console.log('PM20 P06 — errores_sistema aislado por empresa (defecto real corregido en QA): contrato OK');

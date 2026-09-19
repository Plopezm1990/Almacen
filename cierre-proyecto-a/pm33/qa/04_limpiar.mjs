// PM33 P04 -- QA: retira TODO lo insertado por 02 (filas prefijadas
// qa-pm33-) y borra los usuarios de Auth creados por 01, en ese orden.
// Requiere SUPABASE_DB_URL y SUPABASE_SERVICE_ROLE_KEY +
// SUPABASE_PROJECT_URL. Solo borra lo que él mismo identificó por prefijo
// o por los UIDs exactos de ._usuarios_prueba.json -- nunca un DELETE sin
// filtrar.
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DB_URL = process.env.SUPABASE_DB_URL;
const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DB_URL || !PROJECT_URL || !SERVICE_KEY) {
  console.error('Faltan SUPABASE_DB_URL / SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const usuariosPath = fileURLToPath(new URL('./._usuarios_prueba.json', import.meta.url));
const usuarios = JSON.parse(readFileSync(usuariosPath, 'utf8'));
const uids = Object.values(usuarios).map((u) => u.uid);

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`delete from public.membresias_usuario where user_id = any($1::uuid[])`, [uids]);
    await client.query(`delete from public.perfiles where user_id = any($1::uuid[])`, [uids]);
    await client.query(`delete from public.almacen_kv where empresa_id like 'qa-pm33-%' or local_id like 'qa-pm33-%'`);
    await client.query(`delete from public.locales where id like 'qa-pm33-%'`);
    await client.query(`delete from public.empresas where id like 'qa-pm33-%'`);
    await client.query('commit');
    console.log('[OK] filas de prueba retiradas de public.*');
  } catch (e) {
    await client.query('rollback');
    console.error('Fallo limpiando filas, revertido:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }

  const admin = createClient(PROJECT_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const [nombre, u] of Object.entries(usuarios)) {
    const { error } = await admin.auth.admin.deleteUser(u.uid);
    if (error) { console.error(`Fallo borrando usuario ${nombre} (${u.uid}):`, error.message); process.exitCode = 1; }
    else console.log(`[OK] usuario de Auth borrado: ${nombre}`);
  }

  unlinkSync(usuariosPath);
  console.log('Limpieza completada.');
}
main();

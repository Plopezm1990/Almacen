// PM33 P05 -- QA: retira EXACTAMENTE los objetos registrados en
// ._manifest.json (nunca "todo lo que empiece por qa-pm33-", que podría
// alcanzar restos de otra ejecución concurrente o anterior sin limpiar).
// Si algo falla, el manifest NO se borra: queda como registro de lo
// pendiente, con el detalle del fallo, para que un reintento o una
// revisión manual sepan exactamente qué falta.
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { exigirMismoEntorno } from './_entorno.mjs';
import { cargarManifest, guardarManifest, RUTA_MANIFEST } from './_manifest.mjs';
import { unlinkSync } from 'node:fs';

const DB_URL = process.env.SUPABASE_DB_URL;
const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DB_URL || !PROJECT_URL || !SERVICE_KEY) {
  console.error('Faltan SUPABASE_DB_URL / SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
exigirMismoEntorno({ projectUrl: PROJECT_URL, dbUrl: DB_URL });

const manifest = cargarManifest();
if (!manifest) {
  console.log('No hay ._manifest.json -- nada que limpiar.');
  process.exit(0);
}

async function main() {
  let fallo = false;
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    if (manifest.membresiaIds.length) {
      await client.query(`delete from public.membresias_usuario where id = any($1::int[])`, [manifest.membresiaIds]);
    }
    const uids = Object.values(manifest.usuarios).map((u) => u.uid);
    if (uids.length) {
      await client.query(`delete from public.perfiles where user_id = any($1::uuid[])`, [uids]);
    }
    for (const [empresaId, localId, key] of manifest.almacenKv) {
      await client.query(`delete from public.almacen_kv where empresa_id=$1 and local_id=$2 and key=$3`, [empresaId, localId, key]);
    }
    if (manifest.locales.length) {
      await client.query(`delete from public.locales where id = any($1::text[])`, [manifest.locales]);
    }
    if (manifest.empresas.length) {
      await client.query(`delete from public.empresas where id = any($1::text[])`, [manifest.empresas]);
    }
    console.log('[OK] filas de prueba retiradas de public.* (exactamente las del manifest)');
  } catch (e) {
    fallo = true;
    console.error('Fallo limpiando filas de BD:', e.message);
  } finally {
    await client.end();
  }

  const admin = createClient(PROJECT_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const [nombre, u] of Object.entries(manifest.usuarios)) {
    const { error } = await admin.auth.admin.deleteUser(u.uid);
    if (error) { console.error(`Fallo borrando usuario ${nombre} (${u.uid}):`, error.message); fallo = true; }
    else console.log(`[OK] usuario de Auth borrado: ${nombre}`);
  }

  if (fallo) {
    manifest.estado = 'fallo_parcial';
    guardarManifest(manifest);
    console.error(
      `Limpieza incompleta. ${RUTA_MANIFEST} se conserva (NO se borra) con el estado ` +
      `de lo que falta -- vuelve a ejecutar este script, o revísalo a mano.`
    );
    process.exitCode = 1;
    return;
  }

  unlinkSync(RUTA_MANIFEST);
  console.log(`Limpieza completada para RUN_ID=${manifest.runId}. ._manifest.json retirado.`);
}
main();

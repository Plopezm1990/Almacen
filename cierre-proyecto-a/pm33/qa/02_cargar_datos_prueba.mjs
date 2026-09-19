// PM33 P05 -- QA: carga datos de prueba en public.perfiles /
// public.membresias_usuario / public.almacen_kv, vinculados a los UIDs
// REALES creados por 01_crear_usuarios_prueba.mjs. Todo lo que crea este
// script usa el RUN_ID del manifest para que dos ejecuciones nunca
// colisionen, y registra en el manifest exactamente qué creó para que la
// limpieza (04) no dependa de adivinar por prefijo.
//
// CORRIGE un defecto de la versión anterior de este script: escribía la
// fila almacen_kv de (emp-A, loc-A, 'empleados') DOS VECES por separado
// -- primero con [dup, ea6], después con [dup2] -- y el segundo INSERT
// ... ON CONFLICT DO UPDATE SET value = excluded.value REEMPLAZABA el
// valor entero, perdiendo dup y ea6. Ahora cada fila de almacen_kv se
// construye COMPLETA en memoria antes de un único INSERT por fila.
import pg from 'pg';
import { exigirMismoEntorno } from './_entorno.mjs';
import { cargarManifest, guardarManifest } from './_manifest.mjs';

const DB_URL = process.env.SUPABASE_DB_URL;
const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
if (!DB_URL) { console.error('Falta SUPABASE_DB_URL.'); process.exit(1); }
exigirMismoEntorno({ projectUrl: PROJECT_URL, dbUrl: DB_URL });

const manifest = cargarManifest();
if (!manifest) {
  console.error('No hay ._manifest.json -- ejecuta 01_crear_usuarios_prueba.mjs primero.');
  process.exit(1);
}
const runId = manifest.runId;
const usuarios = manifest.usuarios;

const PREFIJO = `qa-pm33-${runId}-`;
const E = {
  empA: PREFIJO + 'emp-A', empB: PREFIJO + 'emp-B',
  locA: PREFIJO + 'loc-A', locB: PREFIJO + 'loc-B',
};
const idDup = PREFIJO + 'dup';
const idEa6 = PREFIJO + 'ea6';
const idDup2 = PREFIJO + 'dup2';

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('begin');

    await client.query(
      `insert into public.empresas (id, nombre, activo) values ($1,'QA PM33 Empresa A',true), ($2,'QA PM33 Empresa B',true)`,
      [E.empA, E.empB]);
    manifest.empresas.push(E.empA, E.empB);

    await client.query(
      `insert into public.locales (id, empresa_id, nombre, activo) values ($1,$3,'QA PM33 Local A',true), ($2,$4,'QA PM33 Local B',true)`,
      [E.locA, E.locB, E.empA, E.empB]);
    manifest.locales.push(E.locA, E.locB);

    // Fila COMPLETA para (empA, locA, 'empleados'): dup (colisión, lado A)
    // + ea6 (activo legítimo) + dup2 (heredado legítimo, sin colisión).
    // Un único INSERT -- no dos que se pisen.
    const empleadosLocA = [
      { id: idDup, nombre: 'QA-COLISION-A', rol: 'Camarero/a', activo: true },
      { id: idEa6, nombre: 'QA-Camarero-Activo', rol: 'Camarero/a', activo: true },
      { id: idDup2, nombre: 'QA-Heredado-Legitimo', rol: 'Camarero/a', activo: true },
    ];
    const empleadosLocB = [
      { id: idDup, nombre: 'QA-COLISION-B', rol: 'Camarero/a', activo: true },
    ];
    await client.query(
      `insert into public.almacen_kv (empresa_id, local_id, key, value) values ($1,$2,'empleados',$3::jsonb)`,
      [E.empA, E.locA, JSON.stringify(empleadosLocA)]);
    manifest.almacenKv.push([E.empA, E.locA, 'empleados']);
    await client.query(
      `insert into public.almacen_kv (empresa_id, local_id, key, value) values ($1,$2,'empleados',$3::jsonb)`,
      [E.empB, E.locB, JSON.stringify(empleadosLocB)]);
    manifest.almacenKv.push([E.empB, E.locB, 'empleados']);

    const filas = [
      ['cajero-a', 'Cajero/a', null, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['cajero-b', 'Cajero/a', null, [{ empresa_id: E.empB, local_id: E.locB, todos_locales: false }]],
      ['encargado-a', 'Encargado', null, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['churrero-a', 'Churrero/a', null, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['camarero-activo', 'Camarero/a', idEa6, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['camarero-colision', 'Camarero/a', idDup, []],
      ['camarero-local-ajeno', 'Camarero/a', idEa6, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['camarero-membresia-revocada', 'Camarero/a', idEa6, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false, activo: false }]],
      ['camarero-heredado-legitimo', 'Camarero/a', idDup2, []],
      ['cajero-colision', 'Cajero/a', idDup, []],
      ['cajero-membresia-revocada', 'Cajero/a', idEa6, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false, activo: false }]],
    ];

    let siguienteMembresiaId;
    {
      const r = await client.query(`select coalesce(max(id),0) + 1000 + floor(random()*100000)::int as base from public.membresias_usuario`);
      siguienteMembresiaId = r.rows[0].base;
    }

    for (const [nombre, rol, empleadoId, membresias] of filas) {
      const u = usuarios[nombre];
      if (!u) { console.warn(`Sin usuario de prueba para ${nombre}, saltando.`); continue; }
      await client.query(
        `insert into public.perfiles (user_id, rol, empleado_id, activo) values ($1,$2,$3,true)`,
        [u.uid, rol, empleadoId]);
      for (const m of membresias) {
        const id = siguienteMembresiaId++;
        await client.query(
          `insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values ($1,$2,$3,$4,$5,$6,$7)`,
          [id, u.uid, m.empresa_id, m.local_id, m.todos_locales, rol, m.activo !== false]);
        manifest.membresiaIds.push(id);
      }
      console.log(`[OK] datos de prueba para ${nombre}`);
    }

    await client.query('commit');

    // Verificación POST-carga antes de declarar éxito, no solo confiar en
    // que los INSERT no lanzaran error.
    const chk = await client.query(
      `select
         (select value from public.almacen_kv where empresa_id=$1 and local_id=$2 and key='empleados') as kv_a,
         (select value from public.almacen_kv where empresa_id=$3 and local_id=$4 and key='empleados') as kv_b,
         (select count(*) from public.perfiles where user_id = any($5::uuid[])) as num_perfiles,
         (select count(*) from public.membresias_usuario where id = any($6::int[])) as num_membresias`,
      [E.empA, E.locA, E.empB, E.locB, Object.values(usuarios).map(u => u.uid), manifest.membresiaIds]);
    const fila = chk.rows[0];
    const kvA = fila.kv_a;
    const idsEnKvA = Array.isArray(kvA) ? kvA.map(e => e.id) : [];
    const okKvA = idsEnKvA.includes(idDup) && idsEnKvA.includes(idEa6) && idsEnKvA.includes(idDup2);
    const okKvB = Array.isArray(fila.kv_b) && fila.kv_b.some(e => e.id === idDup);
    const okPerfiles = Number(fila.num_perfiles) === Object.keys(usuarios).length;
    const okMembresias = Number(fila.num_membresias) === manifest.membresiaIds.length;

    if (!okKvA || !okKvB || !okPerfiles || !okMembresias) {
      manifest.estado = 'fallo_parcial';
      guardarManifest(manifest);
      console.error('Verificación POST-carga FALLIDA:', { okKvA, okKvB, okPerfiles, okMembresias, idsEnKvA });
      console.error('Los datos ya están comprometidos en BD (la transacción hizo commit). Ejecuta 04_limpiar.mjs y revisa antes de reintentar.');
      process.exitCode = 1;
      return;
    }

    manifest.estado = 'confirmado';
    guardarManifest(manifest);
    console.log(`Carga completada y verificada. RUN_ID=${runId}`);
  } catch (e) {
    await client.query('rollback');
    manifest.estado = 'revertido';
    guardarManifest(manifest);
    console.error('Fallo, revertido en BD (nada quedó escrito). Manifest marcado como revertido:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
main();

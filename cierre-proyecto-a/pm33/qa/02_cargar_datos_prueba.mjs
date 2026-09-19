// PM33 P04 -- QA: carga datos de prueba en public.perfiles /
// public.membresias_usuario / public.almacen_kv, vinculados a los UIDs
// REALES creados por 01_crear_usuarios_prueba.mjs (nunca UUIDs
// inventados: deben poder autenticarse de verdad en 03). Todo lo que
// crea este script está prefijado `qa-pm33-` para poder identificarlo y
// borrarlo sin ambigüedad. No toca auth.* ni ninguna fila que no haya
// creado él mismo. Requiere SUPABASE_DB_URL (conexión directa, no la API
// REST) en el entorno.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) { console.error('Falta SUPABASE_DB_URL.'); process.exit(1); }

const usuarios = JSON.parse(readFileSync(fileURLToPath(new URL('./._usuarios_prueba.json', import.meta.url)), 'utf8'));

const PREFIJO = 'qa-pm33-';
const E = {
  empA: PREFIJO + 'emp-A', empB: PREFIJO + 'emp-B',
  locA: PREFIJO + 'loc-A', locB: PREFIJO + 'loc-B',
};

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('begin');

    await client.query(
      `insert into public.empresas (id, nombre, activo) values ($1,'QA PM33 Empresa A',true), ($2,'QA PM33 Empresa B',true)
       on conflict (id) do nothing`, [E.empA, E.empB]);
    await client.query(
      `insert into public.locales (id, empresa_id, nombre, activo) values ($1,$3,'QA PM33 Local A',true), ($2,$4,'QA PM33 Local B',true)
       on conflict (id) do nothing`, [E.locA, E.locB, E.empA, E.empB]);

    await client.query(
      `insert into public.almacen_kv (empresa_id, local_id, key, value) values
        ($1,$2,'empleados', $5::jsonb), ($3,$4,'empleados', $6::jsonb)
       on conflict (empresa_id, local_id, key) do update set value = excluded.value`,
      [E.empA, E.locA, E.empB, E.locB,
       JSON.stringify([{ id: 'qa-pm33-dup', nombre: 'QA-COLISION-A', rol: 'Camarero/a', activo: true },
                        { id: 'qa-pm33-ea6', nombre: 'QA-Camarero-Activo', rol: 'Camarero/a', activo: true }]),
       JSON.stringify([{ id: 'qa-pm33-dup', nombre: 'QA-COLISION-B', rol: 'Camarero/a', activo: true }])]);

    const filas = [
      ['cajero-a', 'Cajero/a', null, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['cajero-b', 'Cajero/a', null, [{ empresa_id: E.empB, local_id: E.locB, todos_locales: false }]],
      ['encargado-a', 'Encargado', null, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['churrero-a', 'Churrero/a', null, [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['camarero-activo', 'Camarero/a', 'qa-pm33-ea6', [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['camarero-colision', 'Camarero/a', 'qa-pm33-dup', []],
      ['camarero-local-ajeno', 'Camarero/a', 'qa-pm33-ea6', [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false }]],
      ['camarero-membresia-revocada', 'Camarero/a', 'qa-pm33-ea6', [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false, activo: false }]],
      ['camarero-heredado-legitimo', 'Camarero/a', 'qa-pm33-dup2', []],
      ['cajero-colision', 'Cajero/a', 'qa-pm33-dup', []],
      ['cajero-membresia-revocada', 'Cajero/a', 'qa-pm33-ea6', [{ empresa_id: E.empA, local_id: E.locA, todos_locales: false, activo: false }]],
    ];

    // Empleado exclusivo para el caso "heredado legítimo" (sin colisión).
    await client.query(
      `insert into public.almacen_kv (empresa_id, local_id, key, value) values ($1,$2,'empleados', $3::jsonb)
       on conflict (empresa_id, local_id, key) do update set value = excluded.value`,
      [E.empA, E.locA, JSON.stringify([{ id: 'qa-pm33-dup2', nombre: 'QA-Heredado-Legitimo', rol: 'Camarero/a', activo: true }])]);

    let membresiaId = 900000; // rango alto, fuera de cualquier id real de producción/QA
    for (const [nombre, rol, empleadoId, membresias] of filas) {
      const u = usuarios[nombre];
      if (!u) { console.warn(`Sin usuario de prueba para ${nombre}, saltando.`); continue; }
      await client.query(
        `insert into public.perfiles (user_id, rol, empleado_id, activo) values ($1,$2,$3,true)
         on conflict (user_id) do update set rol=excluded.rol, empleado_id=excluded.empleado_id, activo=true`,
        [u.uid, rol, empleadoId]);
      for (const m of membresias) {
        await client.query(
          `insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (id) do nothing`,
          [membresiaId++, u.uid, m.empresa_id, m.local_id, m.todos_locales, rol, m.activo !== false]);
      }
      console.log(`[OK] datos de prueba para ${nombre}`);
    }

    await client.query('commit');
    console.log('Carga completada.');
  } catch (e) {
    await client.query('rollback');
    console.error('Fallo, revertido:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
main();

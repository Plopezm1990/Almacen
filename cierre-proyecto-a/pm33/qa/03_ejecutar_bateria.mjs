// PM33 P05 -- QA: ejecuta los escenarios centrales de aislamiento vía
// supabase-js REAL (Auth + PostgREST), con signInWithPassword por cada
// usuario de prueba -- no pg directo, no set_config. Requiere
// SUPABASE_PROJECT_URL y SUPABASE_ANON_KEY, y que 01+02 ya se hayan
// ejecutado (lee el RUN_ID y los ids exactos del manifest, no valores
// fijos -- dos ejecuciones nunca comparten identificadores).
import { createClient } from '@supabase/supabase-js';
import { exigirMismoEntorno } from './_entorno.mjs';
import { cargarManifest } from './_manifest.mjs';

const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!PROJECT_URL || !ANON_KEY) { console.error('Faltan SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY.'); process.exit(1); }
exigirMismoEntorno({ projectUrl: PROJECT_URL, dbUrl: process.env.SUPABASE_DB_URL || PROJECT_URL });

const manifest = cargarManifest();
if (!manifest || manifest.estado !== 'confirmado') {
  console.error(`Manifest ausente o no confirmado (estado: ${manifest ? manifest.estado : 'ninguno'}). Ejecuta 01 y 02 primero, en ese orden, hasta que 02 termine en "confirmado".`);
  process.exit(1);
}
const runId = manifest.runId;
const usuarios = manifest.usuarios;
const PREFIJO = `qa-pm33-${runId}-`;
const LOC_A = PREFIJO + 'loc-A';
const LOC_B = PREFIJO + 'loc-B';
const EMP_A = PREFIJO + 'emp-A';
const EMP_B = PREFIJO + 'emp-B';
const ID_EA6 = PREFIJO + 'ea6';
const ID_DUP2 = PREFIJO + 'dup2';

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detalle) {
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; failures.push(name); console.log(`[FAIL] ${name}${detalle ? ' -- ' + detalle : ''}`); }
}

async function clientePara(nombre) {
  const u = usuarios[nombre];
  if (!u) throw new Error(`Sin usuario de prueba: ${nombre}`);
  const client = createClient(PROJECT_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw new Error(`Login real fallido para ${nombre}: ${error.message}`);
  return client;
}

async function llamar(nombre, pLocalId) {
  const client = await clientePara(nombre);
  const args = pLocalId === undefined ? undefined : { p_local_id: pLocalId };
  return client.rpc('obtener_contexto_operativo', args);
}

async function main() {
  console.log(`Ejecutando contra RUN_ID=${runId}`);

  console.log('\n=== Aislamiento básico Cajero/a A vs B (JWT real) ===');
  {
    const { data: a, error: eA } = await llamar('cajero-a');
    check('cajero-a sin error', !eA, eA && eA.message);
    check('cajero-a acotado a emp-A', a && a.empresaId === EMP_A, JSON.stringify(a));
    const { data: b, error: eB } = await llamar('cajero-b');
    check('cajero-b sin error', !eB, eB && eB.message);
    check('cajero-b acotado a emp-B', b && b.empresaId === EMP_B, JSON.stringify(b));
  }

  console.log('\n=== Colisión de id + local explícito (JWT real) -- nunca autoriza ===');
  {
    const { data: rA } = await llamar('camarero-colision', LOC_A);
    check('camarero-colision pidiendo loc-A: empleado null', rA && rA.empleado === null, JSON.stringify(rA));
    const { data: rB } = await llamar('camarero-colision', LOC_B);
    check('camarero-colision pidiendo loc-B: empleado null', rB && rB.empleado === null, JSON.stringify(rB));
  }

  console.log('\n=== Local ajeno con membresía real en A (JWT real) ===');
  {
    const { data, error } = await llamar('camarero-local-ajeno', LOC_B);
    check('camarero-local-ajeno pidiendo loc-B: sin error y sin dato', !error && data && data.empleado === null, JSON.stringify({ error, data }));
  }

  console.log('\n=== Revocación de membresía bloquea la vía heredada (JWT real) ===');
  {
    const { data } = await llamar('camarero-membresia-revocada');
    check('camarero-membresia-revocada: empleado null', data && data.empleado === null, JSON.stringify(data));
    const { error } = await llamar('cajero-membresia-revocada');
    check('cajero-membresia-revocada: rechazado (bloque obligatorio)', !!error, JSON.stringify(error));
  }

  console.log('\n=== Control: heredado legítimo y activo con membresía siguen funcionando (JWT real) ===');
  {
    const { data: h } = await llamar('camarero-heredado-legitimo');
    check('camarero-heredado-legitimo: empleado resuelto', h && h.empleado && h.empleado.id === ID_DUP2, JSON.stringify(h));
    const { data: act } = await llamar('camarero-activo');
    check('camarero-activo: empleado resuelto (ea6)', act && act.empleado && act.empleado.id === ID_EA6, JSON.stringify(act));
  }

  console.log(`\nPM33_P05_QA_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) { console.log('Fallos:', failures.join(', ')); process.exitCode = 1; }
  else console.log('PM33_P05_QA_OK=1');
}
main();

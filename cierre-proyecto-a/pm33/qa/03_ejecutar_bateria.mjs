// PM33 P04 -- QA: ejecuta los escenarios centrales de aislamiento vía
// supabase-js REAL (Auth + PostgREST), con signInWithPassword por cada
// usuario de prueba -- no pg directo, no set_config. Esto es justamente
// lo que cierra el gap "Auth/PostgREST reales" que las pruebas locales
// (Postgres directo) no pueden cerrar por sí solas. Requiere
// SUPABASE_PROJECT_URL y SUPABASE_ANON_KEY en el entorno.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!PROJECT_URL || !ANON_KEY) { console.error('Faltan SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY.'); process.exit(1); }

const usuarios = JSON.parse(readFileSync(fileURLToPath(new URL('./._usuarios_prueba.json', import.meta.url)), 'utf8'));

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
  console.log('\n=== T01/T02 equivalente: aislamiento básico Cajero/a A vs B (JWT real) ===');
  {
    const { data: a, error: eA } = await llamar('cajero-a');
    check('cajero-a sin error', !eA, eA && eA.message);
    check('cajero-a acotado a emp-A', a && a.empresaId === 'qa-pm33-emp-A', JSON.stringify(a));
    const { data: b, error: eB } = await llamar('cajero-b');
    check('cajero-b sin error', !eB, eB && eB.message);
    check('cajero-b acotado a emp-B', b && b.empresaId === 'qa-pm33-emp-B', JSON.stringify(b));
  }

  console.log('\n=== D1 equivalente: colisión de id + local explícito (JWT real) -- nunca autoriza ===');
  {
    const { data: rA } = await llamar('camarero-colision', 'qa-pm33-loc-A');
    check('camarero-colision pidiendo loc-A: empleado null', rA && rA.empleado === null, JSON.stringify(rA));
    const { data: rB } = await llamar('camarero-colision', 'qa-pm33-loc-B');
    check('camarero-colision pidiendo loc-B: empleado null', rB && rB.empleado === null, JSON.stringify(rB));
  }

  console.log('\n=== D1c equivalente: local ajeno con membresía real en A (JWT real) ===');
  {
    const { data, error } = await llamar('camarero-local-ajeno', 'qa-pm33-loc-B');
    check('camarero-local-ajeno pidiendo loc-B: sin error (rol no gestionado) y sin dato', !error && data && data.empleado === null, JSON.stringify({ error, data }));
  }

  console.log('\n=== D2 equivalente: revocación de membresía bloquea la vía heredada (JWT real) ===');
  {
    const { data } = await llamar('camarero-membresia-revocada');
    check('camarero-membresia-revocada: empleado null', data && data.empleado === null, JSON.stringify(data));
    const { error } = await llamar('cajero-membresia-revocada');
    check('cajero-membresia-revocada: rechazado (bloque obligatorio)', !!error, JSON.stringify(error));
  }

  console.log('\n=== Control: heredado legítimo y activo con membresía siguen funcionando (JWT real) ===');
  {
    const { data: h } = await llamar('camarero-heredado-legitimo');
    check('camarero-heredado-legitimo: empleado resuelto', h && h.empleado && h.empleado.id === 'qa-pm33-dup2', JSON.stringify(h));
    const { data: act } = await llamar('camarero-activo');
    check('camarero-activo: empleado resuelto (ea6)', act && act.empleado && act.empleado.id === 'qa-pm33-ea6', JSON.stringify(act));
  }

  console.log(`\nPM33_P04_QA_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) { console.log('Fallos:', failures.join(', ')); process.exitCode = 1; }
  else console.log('PM33_P04_QA_OK=1');
}
main();

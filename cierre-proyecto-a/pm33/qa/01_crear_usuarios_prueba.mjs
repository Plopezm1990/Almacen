// PM33 P04 -- QA: crea usuarios de Supabase Auth desechables para la
// batería de aislamiento, vía Admin API (nunca escribiendo directamente
// en auth.users). Requiere SUPABASE_PROJECT_URL y
// SUPABASE_SERVICE_ROLE_KEY en el entorno -- nunca hardcodeados aquí.
// No ejecutado contra ningún proyecto real: ver README.md (el preflight
// del entorno objetivo debe pasar primero).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!PROJECT_URL || !SERVICE_KEY) {
  console.error('Faltan SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(PROJECT_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Un escenario por cada caso central de la batería local (T01-T05,
// T16-T20, D1-D2). Contraseñas de un solo uso, generadas al vuelo -- no
// se reutilizan entre ejecuciones ni se guardan en texto plano más allá
// de este proceso.
const ESCENARIOS = [
  'cajero-a', 'cajero-b', 'encargado-a', 'churrero-a',
  'camarero-activo', 'camarero-colision', 'camarero-local-ajeno',
  'camarero-membresia-revocada', 'camarero-heredado-legitimo',
  'cajero-colision', 'cajero-membresia-revocada',
];

function contrasenaAlAzar() {
  return 'Pm33Qa!' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function main() {
  const creados = {};
  for (const nombre of ESCENARIOS) {
    const email = `qa-pm33-${nombre}-${Date.now()}@invalid.example`;
    const password = contrasenaAlAzar();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { pm33_prueba: true, escenario: nombre },
    });
    if (error) { console.error(`Fallo creando ${nombre}:`, error.message); process.exitCode = 1; continue; }
    creados[nombre] = { uid: data.user.id, email, password };
    console.log(`[OK] ${nombre} -> ${data.user.id}`);
  }
  writeFileSync(fileURLToPath(new URL('./._usuarios_prueba.json', import.meta.url)), JSON.stringify(creados, null, 2));
  console.log('Escrito ._usuarios_prueba.json (no versionar -- credenciales de un solo uso).');
}
main();

// PM33 P05 -- QA: crea usuarios de Supabase Auth desechables para la
// batería de aislamiento, vía Admin API (nunca escribiendo directamente
// en auth.users). Requiere SUPABASE_PROJECT_URL y
// SUPABASE_SERVICE_ROLE_KEY en el entorno -- nunca hardcodeados aquí.
// No ejecutado contra ningún proyecto real: ver README.md (el preflight
// del entorno objetivo debe pasar primero).
import { createClient } from '@supabase/supabase-js';
import { nuevoRunId, nuevoManifest, guardarManifest, cargarManifest } from './_manifest.mjs';

const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!PROJECT_URL || !SERVICE_KEY) {
  console.error('Faltan SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (cargarManifest()) {
  console.error(
    'Ya existe ._manifest.json de una ejecución anterior sin limpiar. ' +
    'Ejecuta 04_limpiar.mjs primero, o revísalo a mano -- no se sobrescribe ' +
    'un registro de objetos pendientes sin más.'
  );
  process.exit(1);
}

const admin = createClient(PROJECT_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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
  const runId = nuevoRunId();
  const manifest = nuevoManifest(runId);
  guardarManifest(manifest); // se guarda YA, en pendiente -- si algo falla a partir de aquí, el registro ya existe

  let huboFallo = false;
  for (const nombre of ESCENARIOS) {
    const email = `qa-pm33-${runId}-${nombre}@invalid.example`;
    const password = contrasenaAlAzar();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { pm33_prueba: true, escenario: nombre, runId },
    });
    if (error) {
      console.error(`Fallo creando ${nombre}:`, error.message);
      huboFallo = true;
      continue;
    }
    manifest.usuarios[nombre] = { uid: data.user.id, email, password };
    guardarManifest(manifest); // se persiste tras CADA usuario, no al final
    console.log(`[OK] ${nombre} -> ${data.user.id}`);
  }

  if (huboFallo) {
    manifest.estado = 'fallo_parcial';
    guardarManifest(manifest);
    console.error(
      'Hubo fallos creando usuarios. El manifest (._manifest.json) registra ' +
      'exactamente qué se llegó a crear -- ejecuta 04_limpiar.mjs para retirarlo ' +
      'antes de reintentar.'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`RUN_ID=${runId}`);
  console.log('Escrito ._manifest.json con los usuarios creados.');
}
main();

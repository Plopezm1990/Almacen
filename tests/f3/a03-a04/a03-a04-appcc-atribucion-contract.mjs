import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const migrationPath = path.join(
  root,
  'supabase',
  'migrations',
  '20261109150000_a03_a04_appcc_y_atribucion.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

function mustContain(fragment, message = fragment) {
  assert.ok(sql.includes(fragment.toLowerCase()), `Falta contrato A-03/A-04: ${message}`);
}

// A-03: definición, lectura histórica y corrección forman modelos distintos.
mustContain('create table if not exists public.appcc_puntos_control');
mustContain('create table if not exists public.appcc_lecturas');
mustContain('create table if not exists public.appcc_lectura_correcciones');
mustContain('realizada_en timestamptz');
mustContain('actor_user_id uuid not null');
mustContain('valor_anterior text not null');
mustContain('lectura_original_id uuid not null references public.appcc_lecturas(id)');
mustContain('appcc_registrar_lectura');
mustContain('appcc_corregir_lectura');
mustContain('clock_timestamp()', 'la hora de la lectura debe venir del servidor');
mustContain('alter table public.appcc_lecturas enable row level security');
mustContain('revoke all on table public.appcc_lecturas');

// A-04: la identidad efectiva se deriva de la sesión y del perfil; el texto
// recibido del navegador no puede convertirse en actor persistido.
mustContain("v_uid uuid := (select auth.uid())");
mustContain('select p.empleado_id, p.nombre');
mustContain('actor_empleado_id');
mustContain("'actoruserId', v_uid", 'auditoría con actor de sesión');
mustContain("'empleadoid', v_empleado_id", 'empleado derivado del perfil');

console.log('A03_A04_SCHEMA_AND_SERVER_ACTOR_CONTRACT=PASS');

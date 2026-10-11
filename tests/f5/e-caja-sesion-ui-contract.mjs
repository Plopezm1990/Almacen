import fs from 'node:fs';
import assert from 'node:assert/strict';

const fuente = fs.readFileSync('fuente.js', 'utf8');
const caja = fs.readFileSync('supabase/migrations/20260923210000_abc_f2_m01_base_transaccional_caja.sql', 'utf8');

assert.match(fuente, /function PanelSesionCajaA10\(/);
for (const label of ['Abrir sesión', 'Base de apertura (€)', 'Guardar arqueo', 'Finalizar cierre', 'Sesión cerrada correctamente']) {
  assert.match(fuente, new RegExp(label.replace(/[()€]/g, '\\$&')), `falta la acción de caja: ${label}`);
}
assert.match(fuente, /\.from\("caja_sesiones"\)\.select\("id,estado,version,caja_id"\)/);
assert.doesNotMatch(fuente, /fecha_operativa/);
assert.match(caja, /create table public\.caja_sesiones\s*\(/);
assert.match(caja, /abierta_at timestamptz/);
assert.match(caja, /cerrada_at timestamptz/);
assert.match(caja, /estado text not null default 'PREPARANDO_APERTURA'/);
assert.match(caja, /unique index abc_sesion_activa_por_caja_uq/);
console.log('ABC_E_CAJA_SESION_UI_CONTRACT=PASS');

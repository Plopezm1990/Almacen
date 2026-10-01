import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'docs/plan-abc/F0_INVENTARIO_A01_C12_2026-10-01.md';
const inventory = fs.readFileSync(path, 'utf8');
const pilot = fs.readFileSync('docs/plan-abc/F0_2_DECISION_PILOTO_2026-10-01.md', 'utf8');
const ids = [
  ...Array.from({ length: 12 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
];

for (const id of ids) {
  assert.match(inventory, new RegExp(`\\| ${id} \\|`), `F0 falta ${id}`);
}

assert.match(inventory, /inventario inicial, no cierre funcional/i);
assert.match(inventory, /B07.*BLOQUEADO_PROVEEDOR/s);
assert.match(inventory, /B12.*BLOQUEADO_PROVEEDOR/s);
assert.match(inventory, /no requiere deploy de\s+Netlify/i);
assert.match(inventory, /no activa proveedores/i);

assert.match(pilot, /PENDIENTE_DECISION_USUARIO/);
assert.match(pilot, /Local piloto/);
assert.match(pilot, /Modalidades incluidas/);
assert.match(pilot, /Cajas simultáneas/);
assert.match(pilot, /Responsable de aceptación/);
assert.match(pilot, /sin incluir\s+contraseñas ni\s+secretos/i);
assert.match(pilot, /No requiere migración\s+remota, secretos, merge ni deploy/i);

console.log('ABC_F0_INVENTORY_CONTRACT=PASS');

import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'docs/plan-abc/F0_INVENTARIO_A01_C12_2026-10-01.md';
const inventory = fs.readFileSync(path, 'utf8');
const pilot = fs.readFileSync('docs/plan-abc/F0_2_DECISION_PILOTO_2026-10-01.md', 'utf8');
const journeys = fs.readFileSync('docs/plan-abc/F0_3_MAPA_RECORRIDOS_2026-10-01.md', 'utf8');
const technical = fs.readFileSync('docs/plan-abc/F0_4_INVENTARIO_TECNICO_2026-10-01.md', 'utf8');
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

for (const id of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10']) {
  assert.match(journeys, new RegExp(`\\| ${id} \\|`), `F0 falta ${id}`);
}
assert.match(journeys, /PENDIENTE_EJECUCION_CON_DATOS_FICTICIOS/);
assert.match(journeys, /no se guardarán contraseñas, PAN, CVV, tokens/i);
assert.match(journeys, /no cierra A01–C12/i);
assert.match(journeys, /sin\s+despliegues de Netlify/i);

for (const term of ['Catálogo', 'Precios', 'Impuestos', 'Descuentos', 'Stock', 'Propietario', 'Encargado', 'Cajero', 'Camarero', 'Terminal de caja', 'Impresora', 'Cajón', 'Datáfono', 'Red']) {
  assert.match(technical, new RegExp(term, 'i'), `F0 falta ${term}`);
}
assert.match(technical, /PENDIENTE_RECOGIDA_DE_DATOS/);
assert.match(technical, /No copiar credenciales, tokens, PAN, CVV/i);
assert.match(technical, /no autoriza compras, contratos, migraciones, merge ni deploy/i);

console.log('ABC_F0_INVENTORY_CONTRACT=PASS');

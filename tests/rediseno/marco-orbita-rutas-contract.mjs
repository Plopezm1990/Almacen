import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const fuente = readFileSync(resolve(root, 'fuente.js'), 'utf8');
const shell = readFileSync(resolve(root, 'la-orbita-shell.js'), 'utf8');

// La navegación real sigue viviendo en fuente.js. Este contrato no la duplica:
// comprueba que las familias de módulos que el plan cubre siguen entrando en el
// mismo root autenticado y que el shell dispone de una marca para distinguirlas.
const rutas = [
  'dashboard', 'direccion', 'venta', 'cocina', 'clientes', 'proveedores',
  'pedidos', 'recepcion', 'albaranes', 'facturas', 'productos',
  'historial_producto', 'caja', 'personal', 'configuracion', 'auditoria',
  'encargos', 'devoluciones', 'mermas', 'locales'
];

for (const ruta of rutas) {
  assert.match(fuente, new RegExp(`id: "${ruta}"`), `fuente.js no expone la ruta ${ruta}`);
}

assert.match(fuente, /data-la-contenedor/);
assert.match(fuente, /data-la-barra-inferior/);
assert.match(shell, /function rutaActiva/);
assert.match(shell, /data-la-orbita-route/);
assert.match(shell, /data-la-orbita-surface/);
assert.match(shell, /\.tpv-layout/);
assert.match(shell, /#la-pase/);
assert.match(shell, /la-operacion-cocina/);
assert.match(shell, /la-operacion-caja/);

console.log(`MARCO_ORBITA_RUTAS_CONTRACT=PASS (${rutas.length} rutas)`);

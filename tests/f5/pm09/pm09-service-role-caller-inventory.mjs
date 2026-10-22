import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync('fuente.js', 'utf8');
const recovered = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const edgeRoot = 'supabase/functions';

function filesUnder(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(full));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) result.push(full);
  }
  return result;
}

const edgeSource = filesUnder(edgeRoot).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const clientSource = `${source}\n${recovered}`;

function check(name, ok) {
  console.log(`PM09_CALLER_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

// The browser is the only current caller of the PM09 wrappers in this tree.
check('FRONTEND_REFUND_CALL_PRESENT', clientSource.includes('rpc("registrar_devolucion_venta_pm09"'));
check('FRONTEND_SALE_CALL_PRESENT', clientSource.includes('rpc("registrar_venta_stock_carrito_pm09"'));
check('FRONTEND_REVERT_CALL_PRESENT', clientSource.includes('rpc("revertir_venta_stock_carrito_pm09"'));
check('FRONTEND_USER_CLIENT_CONTEXT', clientSource.includes('window.__nubeCliente.rpc("registrar_devolucion_venta_pm09"') && clientSource.includes('window.getSupabaseClient()'));
check('NO_PM09_EDGE_CALLER', !/(?:registrar_devolucion_venta_pm09|registrar_venta_stock(?:_carrito)?_pm09|revertir_venta_stock(?:_carrito)?_pm09)/.test(edgeSource));
check('NO_PM09_SERVICE_KEY_CALLER', !/SUPABASE_SERVICE_ROLE_KEY[\s\S]{0,500}registrar_|registrar_[\s\S]{0,500}SUPABASE_SERVICE_ROLE_KEY/.test(edgeSource));

if (process.exitCode) throw new Error('PM09_CALLER_INVENTORY_FAIL');
console.log('PM09_CALLER_INVENTORY_OK=1');

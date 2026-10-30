import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../../supabase/migrations/20261029210000_abc_d09_d11_economic_snapshot.sql', import.meta.url),
  'utf8'
);
const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');

assert.match(migration, /'ingresoUnitario',coalesce\(p_linea\.precio_unitario,0\)/);
assert.match(migration, /'ivaVentaAplicado',v_iva/);
assert.match(migration, /'importeLinea',coalesce\(p_linea\.total,0\)/);
assert.match(fuente, /ingresoUnitario: Number\.isFinite\(precioEnDatos\) \? precioEnDatos : 0/);
assert.match(fuente, /ivaVentaAplicado: Number\.isFinite\(ivaEnDatos\) \? ivaEnDatos : 0/);
assert.match(fuente, /from\("pedido_lineas"\)\.select\("id,precio_unitario,base,impuestos,total,snapshot_comercial"\)/);
assert.match(fuente, /lineaEconomicaPorId/);

console.log('D09 economic snapshot contract: OK');

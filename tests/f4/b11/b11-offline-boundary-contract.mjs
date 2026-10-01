import assert from 'node:assert/strict';
import fs from 'node:fs';

const decision = fs.readFileSync('docs/plan-maestro/PM03_CONTRATOS_MINIMOS_PROPUESTA.md', 'utf8');
const source = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const pm07 = fs.readFileSync('tests/pm07/frontend-contract.mjs', 'utf8');
const contract = fs.readFileSync('docs/plan-abc/F4_B11_CONTRATO_TECNICO_2026-10-01.md', 'utf8');

assert.match(decision, /Sin conexión confirmable se pueden consultar datos locales y preparar borradores, pero no se confirman mutaciones críticas/i);
assert.match(decision, /Se bloquean en modo sincronizado las mutaciones críticas.*venta\/stock, recepción, pago, devolución\/reembolso, traspaso y cierre\/arqueo/i);
assert.match(source, /function claveBorradorTpvA06\(/);
assert.match(source, /estado: "BORRADOR_LOCAL"/);
assert.match(source, /Borrador local activo/);
assert.match(source, /No se puede acceder al borrador local del TPV/);
assert.match(pm07, /venta_solo_un_fallback_offline/);
assert.match(pm07, /venta_offline_sin_deficit/);
assert.match(contract, /no activa pagos offline/i);
assert.match(contract, /no se finge\s+una confirmación bancaria/i);

console.log('ABC_F4_B11_OFFLINE_BOUNDARY=PASS');

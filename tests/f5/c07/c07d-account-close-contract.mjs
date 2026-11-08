import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261028190000_abc_f4_cuenta_cierre_pagada.sql", "utf8");
const source = fs.readFileSync("fuente.js", "utf8");

assert.match(migration, /create or replace function public\.abc_cerrar_cuenta_pagada\(/);
assert.match(migration, /p_expected_cuenta_version bigint/);
assert.match(migration, /estado='CERRADA'/);
assert.match(migration, /CUENTA_CERRADA_PAGADA/);
assert.match(migration, /pago_aplicaciones/);
assert.match(migration, /pago_intentos/);
assert.match(migration, /cuenta_saldo_pendiente/);
assert.match(migration, /cuenta_incidencia_cobro_abierta/);
assert.match(migration, /private\.abc_operacion_iniciar/);
assert.match(migration, /private\.abc_operacion_completar/);
assert.match(migration, /private\.abc_operacion_fallar/);
assert.match(migration, /grant execute on function public\.abc_cerrar_cuenta_pagada/);

assert.match(source, /async function cerrarCuentaPagadaF4\(/);
assert.match(source, /supabase\.rpc\("abc_cerrar_cuenta_pagada"/);
assert.match(source, /cerrarCuentaPagadaF4/);
assert.match(source, /cuenta_estado/);
assert.match(source, /cuentaCierre/);

console.log("c07d-account-close-contract: ok");

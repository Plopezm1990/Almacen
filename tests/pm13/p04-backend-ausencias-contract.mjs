import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql = fs.readFileSync('supabase/migrations/20260907212000_pm13_p04_ausencias_trazables.sql', 'utf8');

assert.match(sql, /public\.pm13_registrar_ausencia\(/);
assert.match(sql, /public\.pm13_anular_ausencia\(/);
assert.match(sql, /public\.empleados%rowtype/);
assert.match(sql, /datos->'ausencias'/);
assert.match(sql, /FOR UPDATE/);
assert.match(sql, /private\.pm11_puede_mutar_personal/);
assert.match(sql, /v_empleado\.estado <> 'activo'/);
assert.match(sql, /ausencia_rango_fechas_invalido/);
assert.match(sql, /ausencia_tipo_invalido/);
assert.match(sql, /ausencia_solapada/);
assert.match(sql, /operationId/);
assert.match(sql, /anulacionOperationId/);
assert.match(sql, /estado', 'ANULADA'/);
assert.match(sql, /private\.pm11_auditar_empleado/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.pm13_registrar_ausencia[\s\S]*FROM PUBLIC, anon/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.pm13_anular_ausencia[\s\S]*FROM PUBLIC, anon/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.pm13_registrar_ausencia[\s\S]*TO authenticated/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.pm13_anular_ausencia[\s\S]*TO authenticated/);
assert.doesNotMatch(sql, /CREATE TABLE/i);
assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.empleados/i);
assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN|FUNCTION)/i);

console.log('PM13_P04_AUSENCIAS_BACKEND=PASS');
console.log('MISMA_ENTIDAD_EMPLEADOS=1');
console.log('ROW_LOCK_REPLAY_SOLAPE=1');
console.log('ANULACION_TRAZABLE=1');
console.log('SIN_DDL_DESTRUCTIVO=1');

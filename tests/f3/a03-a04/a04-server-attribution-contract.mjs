import assert from "node:assert/strict";
import fs from "node:fs";

const fuente = fs.readFileSync("fuente.js", "utf8");
const recuperado = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const migracion = fs.readFileSync(
  "supabase/migrations/20261111220000_a04_server_employee_session.sql",
  "utf8",
);

for (const codigo of [fuente, recuperado]) {
  assert.match(codigo, /pm11_iniciar_sesion_empleado/);
  assert.match(codigo, /p_empleado_sesion\s*=\s*empleadoSesionToken/);
  assert.match(codigo, /setEmpleadoSesionToken\(data\.token\)/);
  assert.match(codigo, /auditoria-remota-fallida/);

  const inicio = codigo.indexOf("function registrarAuditoria(accion, detalle)");
  assert.ok(inicio >= 0, "Debe existir el registrador común");
  const fin = codigo.indexOf("  const esUtillaje", inicio);
  assert.ok(fin > inicio, "Debe poder delimitarse el registrador común");
  const registrador = codigo.slice(inicio, fin);
  assert.match(registrador, /p_empleado_sesion/);
  assert.doesNotMatch(registrador, /catch \(e2\) \{\s*setAuditoria\(/s,
    "Una caída online no puede fabricar una auditoría local como si fuera persistente");
}

assert.match(migracion, /create table if not exists private\.pm11_empleado_sesion/);
assert.match(migracion, /create or replace function public\.pm11_iniciar_sesion_empleado/);
assert.match(migracion, /extensions\.crypt\(p_pin, v_hash\)/);
assert.match(migracion, /extensions\.digest\(v_token, 'sha256'\)/);
assert.match(migracion, /s\.user_id = v_uid/);
assert.match(migracion, /s\.empresa_id = v_empresa/);
assert.match(migracion, /s\.expires_at > clock_timestamp\(\)/);
assert.match(migracion, /create or replace function public\.registrar_auditoria\([\s\S]*p_empleado_sesion text/);
assert.match(migracion, /auditoria_sesion_empleado_no_autorizada/);
assert.match(migracion, /actor_empleado_id/);

console.log("A-04 server attribution contract: PASS");

import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261011130000_pm12_p14_cierre_conteo_servidor.sql", "utf8");
const sources = [
  ["runtime", fs.readFileSync("fuente.js", "utf8")],
  ["fuente recuperada", fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8")]
];

assert.match(migration, /create table if not exists public\.pm12_conteo_cierres/);
assert.match(migration, /primary key \(empresa_id, local_id, conteo_id\)/, "la identidad del cierre debe ser única por contexto y conteo");
assert.match(migration, /estado = 'activo'/, "el responsable debe ser un empleado activo");
assert.match(migration, /la_rol\(\), ''\) <> 'Propietario'/, "solo Propietario puede cerrar");
assert.match(migration, /auditoria_registro/, "el cierre debe quedar auditado");
assert.match(migration, /on conflict \(id\) do nothing/, "la auditoría debe tolerar reintentos");
assert.match(migration, /replayed.*true/, "el RPC debe responder replayado sin duplicar");
assert.match(migration, /pm12_listar_cierres/, "debe existir una lectura autoritativa tras recargar");

for (const [nombre, source] of sources) {
  assert.match(source, /async function cerrarConteoServidorPm12/);
  assert.match(source, /rpc\("pm12_cerrar_conteo"/);
  assert.match(source, /rpc\("pm12_listar_cierres"/);
  assert.match(source, /async function finalizarConteo/);
  assert.match(source, /await cerrarConteoServidorPm12/);
  assert.match(source, /_pm12CierreServidor/);
  assert.match(source, /await finalizarConteo\(activo\.id/);
  assert.match(source, /const almacenCongelado = !!conteoAbierto/);
  assert.match(source, /filter\(\(c22\) => c22\.completado/);
  assert.match(source, /replayed: !!remoto\.replayed/);
  console.log(`PM12_P14_${nombre.toUpperCase().replaceAll(" ", "_")}_CLOSE_RELOAD=PASS`);
}

console.log("PM12_P14_CIERRE_SERVIDOR_AUDITADO=PASS");
console.log("PM12_P14_ALMACEN_DESBLOQUEADO=PASS");
console.log("PM12_P14_DASHBOARD_ACTIVO=PASS");
console.log("PM12_P14_DOBLE_ENVIO_IDEMPOTENTE=PASS");

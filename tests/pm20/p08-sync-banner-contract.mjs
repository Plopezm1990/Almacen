import fs from "node:fs";
import assert from "node:assert/strict";

const fuente = fs.readFileSync(new URL("../../fuente.js", import.meta.url), "utf8");
const storage = fs.readFileSync(new URL("../../index-storage-bootstrap.js", import.meta.url), "utf8");

assert.match(fuente, /falloGuardadoVisiblePM15\?\.motivo === "pendiente"/);
assert.match(fuente, /falloGuardadoVisiblePM15\?\.motivo === "parcial"/);
assert.match(fuente, /falloGuardadoVisiblePM15\.motivo === "cuota" \|\| falloGuardadoVisiblePM15\.motivo === "permisos"/);
assert.match(fuente, /"aria-live": falloGuardadoVisiblePM15\.motivo === "cuota" \|\| falloGuardadoVisiblePM15\.motivo === "permisos" \? "assertive" : "polite"/);
assert.match(fuente, /window\.reintentarSincronizacion\(key\)/);
assert.match(fuente, /"Reintentar"/);
assert.match(storage, /window\.reintentarSincronizacion = async function \(key\)/);
assert.match(storage, /marcarPendiente\(key, value, cacheKey\)/);
assert.match(storage, /pendienteSincronizacion: pendienteSincronizacion/);

console.log("PM20 P08 aviso de sincronización y reintento: contrato estático OK");

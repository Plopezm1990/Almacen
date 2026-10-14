import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const storage = fs.readFileSync(new URL('index-storage-bootstrap.js', root), 'utf8');
const fuente = fs.readFileSync(new URL('fuente.js', root), 'utf8');
const recovery = fs.readFileSync(new URL('source-recovery/fuente-recuperado.js', root), 'utf8');

assert.match(storage, /function contextoKvActual\(\)/, 'el bootstrap resuelve el contexto KV');
assert.match(storage, /__empresaActivaIdParaContexto/, 'el bootstrap usa la empresa activa');
assert.match(storage, /consultaKvPorClave\(key, "value"\)\.maybeSingle\(\)/, 'la lectura KV usa el helper contextual');
assert.match(storage, /\.eq\("empresa_id", contexto\.empresaId\)/, 'la lectura KV queda acotada por empresa');
assert.match(storage, /upsert\(\{\s*empresa_id: contexto\.empresaId,\s*key: key,\s*value: aSubir,\s*local_id: null\s*\}\)/s, 'la escritura KV incluye empresa_id y local_id');
assert.doesNotMatch(storage, /upsert\(\{ key: key, value: aSubir \}\)/, 'no queda upsert KV global');
assert.match(storage, /\.delete\(\)\.eq\("empresa_id", contextoBorrado\.empresaId\)\.eq\("key", key\)/, 'el borrado KV queda acotado por empresa');
assert.match(fuente, /key === "localActivoId" && window\.__nubeActiva && typeof window\.__empresaActivaIdParaContexto === "string"/, 'el cambio de local no se pierde mientras se renueva el contexto');
assert.match(fuente, /contexto = await obtenerContexto\(true\)/, 'el guard de local reintenta el contexto antes de guardar');

for (const [nombre, codigo] of [['fuente.js', fuente], ['fuente-recuperado.js', recovery]]) {
  assert.match(codigo, /window\.__empresaActivaIdParaContexto = empresaDelLocalActivo\?\.id \? String\(empresaDelLocalActivo\.id\) : null;/, `${nombre}: publica empresa activa`);
}
const inicio = fuente.indexOf('const empresaDelLocalActivo =');
const fin = fuente.indexOf('const empleadosIdentidadKeyPM11 =', inicio);
const inicioRec = recovery.indexOf('const empresaDelLocalActivo =');
const finRec = recovery.indexOf('const empleadosIdentidadKeyPM11 =', inicioRec);
assert.equal(fuente.slice(inicio, fin), recovery.slice(inicioRec, finRec), 'el bloque contextual mantiene paridad con recuperación');

console.log('PM12 P14 contrato de persistencia KV contextual OK');

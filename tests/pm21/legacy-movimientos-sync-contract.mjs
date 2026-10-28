import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Ejecuta la implementación real de sincronizarColeccionPorFila sin red ni BD.
// El doble de Supabase simula conflictos de unicidad y rechazos RLS.
const src = fs.readFileSync(new URL("../../index-storage-bootstrap.js", import.meta.url), "utf8")
  .replace(/\r\n/g, "\n");
const start = src.indexOf("  var CAMPOS_SINCRONIZACION_SOLO_LOCAL = {");
const end = src.indexOf("  /* ----------------------------------------------------------\n     COLECCIONES GUARDADAS EN BLOQUE", start);
assert.ok(start !== -1 && end > start, "fragmento funcional localizado");
const code = src.slice(start, end) + "\nthis.__sincronizar = sincronizarColeccionPorFila;";

assert.match(src, /var NUNCA_BORRAR = \{ auditoria: true, movimientos: true \}/);
assert.match(src, /tablaEspecial && key === "movimientos"/);
assert.match(src, /if \(!esMovimientoHistorico && idsParaBorrar\.length > 0\)/);

const nuevo = (id = "mov-1") => ({
  id, fecha: "2026-10-27", empresaId: "QA-EMP-A", localId: "QA-A1",
  tipo: "AJUSTE_TEST", cantidad: 2,
});
function contexto({ inicial = [], borrados = [], denegar = false, carrera = null } = {}) {
  const rows = new Map(inicial.map(x => [x.id, structuredClone(x)]));
  const op = { insert: 0, upsert: 0, delete: 0, select: 0, writes: [] };
  const cliente = {
    from(tabla) {
      return {
        async insert(batch) {
          assert.equal(tabla, "movimientos_registro");
          op.insert++;
          if (denegar) return { error: { code: "42501", message: "RLS deniega INSERT" } };
          for (const fila of batch) {
            if (carrera && !rows.has(fila.id)) rows.set(fila.id, { id: fila.id, datos: structuredClone(carrera) });
            if (rows.has(fila.id)) return { error: { code: "23505", message: "duplicate key" } };
            rows.set(fila.id, structuredClone(fila));
            op.writes.push(structuredClone(fila));
          }
          return { error: null };
        },
        async upsert(batch) {
          op.upsert++;
          for (const fila of batch) rows.set(fila.id, structuredClone(fila));
          return { error: null };
        },
        select() {
          op.select++;
          return {
            eq(key, id) {
              assert.equal(key, "id");
              return { async maybeSingle() { return { data: rows.get(id) || null, error: null }; } };
            },
          };
        },
        delete() {
          op.delete++;
          return { async in() { return { error: null }; } };
        },
      };
    },
  };
  const sandbox = {
    window: { __nubeCliente: cliente },
    leerFilasCompletas: async () => [...rows.values()],
    borradosDe: () => borrados,
    guardarBorrados() {},
    Date, JSON, Object, Error,
  };
  vm.runInNewContext(code, sandbox, { filename: "index-storage-bootstrap.js" });
  return { rows, op, sync: sandbox.__sincronizar };
}

test("alta histórica: insert con empresa/local explícitos, nunca upsert", async () => {
  const c = contexto();
  await c.sync("movimientos_registro", [nuevo()], "movimientos");
  assert.equal(c.op.insert, 1);
  assert.equal(c.op.upsert, 0);
  assert.equal(c.rows.get("mov-1").empresa_id, "QA-EMP-A");
  assert.equal(c.rows.get("mov-1").local_id, "QA-A1");
  await c.sync("movimientos_registro", [nuevo()], "movimientos");
  assert.equal(c.op.insert, 1, "reintento ya confirmado no duplica");
});

test("movimiento PM07 autoritativo no se copia al ledger heredado", async () => {
  const c = contexto();
  await c.sync("movimientos_registro", [{ ...nuevo(), _pm07Servidor: true }], "movimientos");
  assert.equal(c.op.insert, 0);
  assert.equal(c.rows.size, 0);
});

test("movimiento remoto inmutable: contenido divergente se rechaza sin escritura", async () => {
  const c = contexto({ inicial: [{ id: "mov-1", datos: nuevo() }] });
  await assert.rejects(c.sync("movimientos_registro", [{ ...nuevo(), cantidad: 3 }], "movimientos"), /movimiento_historico_divergente/);
  assert.equal(c.op.upsert + c.op.insert + c.op.delete, 0);
  assert.equal(c.rows.get("mov-1").datos.cantidad, 2);
});

test("alta sin empresa/local o con local TODOS se bloquea antes de escribir", async () => {
  for (const data of [
    { ...nuevo(), empresaId: "" },
    { ...nuevo(), localId: "" },
    { ...nuevo(), localId: "TODOS" },
    { ...nuevo(), localId: "TODOS LOS LOCALES" },
  ]) {
    const c = contexto();
    await assert.rejects(c.sync("movimientos_registro", [data], "movimientos"), /movimiento_historico_sin_empresa_local/);
    assert.equal(c.op.insert, 0);
  }
});

test("RLS denegada: fallo seguro, sin escritura local simulada ni fallback", async () => {
  const c = contexto({ denegar: true });
  await assert.rejects(c.sync("movimientos_registro", [nuevo()], "movimientos"));
  assert.equal(c.op.insert, 1);
  assert.equal(c.rows.size, 0);
  assert.equal(c.op.upsert, 0);
});

test("carrera con mismo id y contenido idéntico: replay idempotente", async () => {
  const c = contexto({ carrera: nuevo() });
  await c.sync("movimientos_registro", [nuevo()], "movimientos");
  assert.equal(c.op.insert, 1);
  assert.equal(c.op.select, 1);
  assert.equal(c.rows.size, 1);
  assert.equal(c.op.upsert, 0);
});

test("carrera con mismo id y contenido diferente: conservar remoto y avisar error", async () => {
  const c = contexto({ carrera: { ...nuevo(), cantidad: 99 } });
  await assert.rejects(c.sync("movimientos_registro", [nuevo()], "movimientos"));
  assert.equal(c.rows.get("mov-1").datos.cantidad, 99);
  assert.equal(c.op.upsert, 0);
});

test("borrados locales antiguos jamás eliminan movimientos remotos", async () => {
  const c = contexto({ inicial: [{ id: "mov-1", datos: nuevo() }], borrados: ["mov-1"] });
  await c.sync("movimientos_registro", [], "movimientos");
  assert.equal(c.op.delete, 0);
  assert.equal(c.rows.size, 1);
});

test("la sincronización de fichajes mantiene su rama histórica", async () => {
  const c = contexto();
  await c.sync("fichajes_registro", [{ id: "fich-1", fecha: "2026-10-27" }], "fichajes");
  assert.equal(c.op.upsert, 1);
  assert.equal(c.op.insert, 0);
});

test("formato inválido de movimientos no permite sincronizar", async () => {
  const c = contexto();
  await assert.rejects(c.sync("movimientos_registro", null, "movimientos"), /movimientos_historicos_lista_invalida/);
  assert.equal(c.op.insert, 0);
});

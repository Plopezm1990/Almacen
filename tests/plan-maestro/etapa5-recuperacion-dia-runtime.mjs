import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fuente = readFileSync(fileURLToPath(new URL("../../fuente.js", import.meta.url)), "utf8");
const inicio = fuente.indexOf("  async function listarCuentasRecuperablesA06(");
const fin = fuente.indexOf("\n  function leerPedidoOperativoA05()", inicio);
assert.ok(inicio >= 0 && fin > inicio, "No se encontró el adaptador de cuentas recuperables");
const adaptador = fuente.slice(inicio, fin);

const empresaId = "qa-empresa-a";
const localId = "qa-local-a1";
const cuentaId = "589e2885-f54c-4076-812a-71f57f02d9e7";
const otraCuentaId = "92f355a6-1047-428c-8a20-ae2329342052";
const diaServidor = "2026-10-23";
const terminalId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

function cuenta(id, dia = diaServidor) {
  return {
    cuenta_id: id,
    version: 1,
    estado: "ABIERTA",
    opened_operating_day: dia,
    pedidos_count: 1,
    lineas_activas_count: 1,
    reanudable_mismo_dia: true
  };
}

function escenario({ contexto = null, falloDia = null, dia = diaServidor } = {}) {
  const llamadas = [];
  const cliente = {
    rpc: async (nombre, parametros) => {
      llamadas.push({ nombre, parametros });
      if (nombre === "abc_obtener_dia_operativo_local") {
        return falloDia
          ? { data: null, error: new Error(falloDia) }
          : { data: { ok: true, operating_day: dia }, error: null };
      }
      if (nombre === "abc_listar_cuentas_recuperables") {
        return {
          data: { ok: true, operating_day: parametros.p_operating_day, cuentas: [cuenta(cuentaId), cuenta(otraCuentaId)] },
          error: null
        };
      }
      throw new Error(`RPC inesperada: ${nombre}`);
    }
  };
  const dependencias = {
    localActivoId: localId,
    empresaDelLocalActivo: { id: empresaId },
    leerContextoCuentaA02: () => {
      if (contexto === "corrupto") throw new Error("contexto_cuenta_persistido_invalido");
      return contexto;
    },
    window: { __nubeActiva: true, getSupabaseClient: async () => cliente },
    contextoTerminalA02: async () => ({ terminalId, sessionId }),
    respuestaErrorA06: (error) => ({ ok: false, error: String(error.message || error) }),
    versionServidorA02: (version) => Number(version),
    uuidPersistidoA02: (id) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(String(id))
  };
  const listar = new Function(...Object.keys(dependencias), `${adaptador}\nreturn listarCuentasRecuperablesA06;`)(...Object.values(dependencias));
  return { listar, llamadas };
}

{
  const { listar, llamadas } = escenario();
  const resultado = await listar();
  assert.equal(resultado.ok, true, "Una sesión limpia debe consultar las cuentas");
  assert.deepEqual(resultado.cuentas.map((item) => item.cuenta_id), [cuentaId, otraCuentaId]);
  assert.deepEqual(llamadas.map((item) => item.nombre), ["abc_obtener_dia_operativo_local", "abc_listar_cuentas_recuperables"]);
  assert.equal(llamadas[1].parametros.p_operating_day, diaServidor);
  assert.equal(llamadas[1].parametros.p_terminal_id, terminalId);
  assert.equal(llamadas[1].parametros.p_session_id, sessionId);
}

{
  const { listar, llamadas } = escenario({ contexto: { cuentaId, operatingDay: "2026-10-22" } });
  const resultado = await listar();
  assert.equal(resultado.ok, true);
  assert.equal(resultado.cuentas.length, 2, "Un contexto de ayer no debe ocultar cuentas de hoy");
  assert.equal(llamadas[1].parametros.p_operating_day, diaServidor);
}

{
  const { listar } = escenario({ contexto: { cuentaId, operatingDay: diaServidor } });
  const resultado = await listar();
  assert.deepEqual(resultado.cuentas.map((item) => item.cuenta_id), [otraCuentaId], "La cuenta activa no se ofrece para recuperar");
}

{
  const { listar } = escenario({ contexto: "corrupto" });
  const resultado = await listar();
  assert.equal(resultado.ok, true, "Un contexto local corrupto no debe impedir la lectura del servidor");
  assert.equal(resultado.cuentas.length, 2);
}

{
  const { listar, llamadas } = escenario({ falloDia: "abc_caja_no_autorizado" });
  const resultado = await listar();
  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /permiso para consultar el día operativo/);
  assert.deepEqual(llamadas.map((item) => item.nombre), ["abc_obtener_dia_operativo_local"], "No se debe adivinar el día si falla la autoridad");
}

console.log("PLAN_MAESTRO_ETAPA5_RECUPERACION_DIA_RUNTIME_OK=1");

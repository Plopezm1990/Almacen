import fs from "node:fs";

// A08.1: endurece la fuente canónica y materializa el runtime publicado de la rama.
// Validación final del HEAD materializado.
const recoveredPath = "source-recovery/fuente-recuperado.js";
const runtimePath = "fuente.js";
let recovered = fs.readFileSync(recoveredPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");

function replaceOnce(text, oldValue, newValue, label) {
  const first = text.indexOf(oldValue);
  if (first < 0) throw new Error("A08_1_PATCH_NOT_FOUND_" + label);
  if (text.indexOf(oldValue, first + oldValue.length) >= 0) {
    throw new Error("A08_1_PATCH_AMBIGUOUS_" + label);
  }
  return text.slice(0, first) + newValue + text.slice(first + oldValue.length);
}

let recoveryChanged = false;
const listNeedle = "  async function listarCuentasRepartoA08() {";

if (!recovered.includes("  async function consultarRepartoCuentaA08() {")) {
  const consultFn = `  async function consultarRepartoCuentaA08() {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de repartir productos." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "El reparto de productos necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const { data, error } = await supabase.rpc("abc_consultar_reparto_cuenta", {
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_cuenta_id: contexto.cuentaId,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contexto.operatingDay
      });
      if (error) throw error;
      if (!data?.ok || String(data.cuenta_id || "") !== String(contexto.cuentaId)) {
        throw new Error("reparto_consultar_respuesta_invalida");
      }
      if (String(data.estado || "") !== "ABIERTA") throw new Error("reparto_cuenta_no_abierta");
      if (String(data.operating_day || "") !== String(contexto.operatingDay)) {
        throw new Error("reparto_operating_day_incompatible");
      }
      if (!data.reparto || !Array.isArray(data.reparto.lineas)) {
        throw new Error("reparto_consultar_respuesta_invalida");
      }
      return {
        ok: true,
        origen: {
          cuenta_id: data.cuenta_id,
          estado: data.estado,
          version: versionServidorA02(data.version, "a08.snapshot.cuenta_version"),
          currency_code: data.currency_code,
          opened_operating_day: data.operating_day,
          reparto: data.reparto
        },
        terminalId: terminal.terminalId,
        sessionId: terminal.sessionId,
        operatingDay: contexto.operatingDay
      };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

`;
  recovered = replaceOnce(recovered, listNeedle, consultFn + listNeedle, "CONSULT_INSERT");
  recoveryChanged = true;
}

const listStart = recovered.indexOf(listNeedle);
const moveStart = recovered.indexOf("\n  async function moverCantidadLineaCuentaA08(", listStart);
if (listStart < 0 || moveStart < 0) throw new Error("A08_1_LIST_BLOCK_NOT_FOUND");
let listBlock = recovered.slice(listStart, moveStart);
const originalListBlock = listBlock;

if (!listBlock.includes("const consulta = await consultarRepartoCuentaA08();")) {
  listBlock = replaceOnce(
    listBlock,
    `      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";`,
    `      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      const consulta = await consultarRepartoCuentaA08();
      if (!consulta?.ok) return consulta;
      const origen = consulta.origen;
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";`,
    "LIST_USE_CONSULT"
  );
}
const oldOrigin = `      const origen = cuentas.find((cuenta) => String(cuenta.cuenta_id || "") === String(contexto.cuentaId));
      if (!origen) throw new Error("reparto_cuenta_no_encontrada");
      const moneda = String(origen.currency_code || contexto.currencyCode || "");`;
if (listBlock.includes(oldOrigin)) {
  listBlock = replaceOnce(
    listBlock,
    oldOrigin,
    `      const moneda = String(origen.currency_code || contexto.currencyCode || "");`,
    "LIST_ORIGIN_FROM_SNAPSHOT"
  );
}
if (listBlock !== originalListBlock) {
  recovered = recovered.slice(0, listStart) + listBlock + recovered.slice(moveStart);
  recoveryChanged = true;
}

if (!recovered.includes('const operationId = "a08.1.linea:" + operationHash')) {
  const oldOperation = /      const operationId = \[\n        "a08\.1\.linea",[\s\S]*?      \]\.join\("\."\);/;
  if (!oldOperation.test(recovered)) throw new Error("A08_1_OLD_OPERATION_ID_NOT_FOUND");
  recovered = recovered.replace(
    oldOperation,
    `      const operationSeed = JSON.stringify({
        empresaId,
        localId: localActivoId,
        lineaId,
        cuentaOrigenId: contexto.cuentaId,
        cuentaDestinoId: destinoId,
        cantidad: cantidadNumero,
        comensalRef: comensal || null,
        expectedOrigenVersion: origenVersion,
        expectedDestinoVersion: destinoVersion,
        expectedLineaVersion: lineaVersion,
        terminalId: terminal.terminalId,
        sessionId: terminal.sessionId,
        operatingDay: contexto.operatingDay
      });
      const operationDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(operationSeed));
      const operationHash = Array.from(new Uint8Array(operationDigest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const operationId = "a08.1.linea:" + operationHash;`
  );
  recoveryChanged = true;
}

for (const required of [
  'supabase.rpc("abc_consultar_reparto_cuenta"',
  "const consulta = await consultarRepartoCuentaA08();",
  'crypto.subtle.digest("SHA-256"',
  'const operationId = "a08.1.linea:" + operationHash'
]) {
  if (!recovered.includes(required)) throw new Error("A08_1_PATCH_MISSING_" + required);
}
if (recovered.includes("comensal.slice(0, 32)")) throw new Error("A08_1_UNSAFE_OPERATION_ID_REMAINS");

if (recoveryChanged) {
  fs.writeFileSync(recoveredPath, recovered);
  console.log("A08_1_SOURCE_RECOVERY_PATCHED=1");
} else {
  console.log("A08_1_SOURCE_RECOVERY_ALREADY_CURRENT=1");
}

const lines = recovered.split("\n");
if (lines[0] !== "// FUENTE RECUPERADO DESDE EL BUNDLE CANDIDATO DE L&A SUITE.") {
  throw new Error("A08_1_BAD_RECOVERY_HEADER");
}
const body = lines.slice(14).join("\n");
const marker = "var C2 = {";
const first = runtime.indexOf(marker);
const second = runtime.indexOf(marker, first + 1);
if (first < 0 || second >= 0) throw new Error("A08_1_RUNTIME_BOUNDARY_AMBIGUOUS");

const materialized = runtime.slice(0, first) + body;
if (materialized !== runtime) {
  fs.writeFileSync(runtimePath, materialized);
  console.log("A08_1_RUNTIME_MATERIALIZED=PASS");
} else {
  console.log("A08_1_RUNTIME_ALREADY_CURRENT=1");
}

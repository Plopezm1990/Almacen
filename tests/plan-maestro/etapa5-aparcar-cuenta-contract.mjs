import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fuente = readFileSync(fileURLToPath(new URL("../../fuente.js", import.meta.url)), "utf8");
const inicioDominio = fuente.indexOf("  function aparcarCuentaA06()");
const finDominio = fuente.indexOf("\n  async function recuperarCuentaA06", inicioDominio);
assert.ok(inicioDominio >= 0 && finDominio > inicioDominio, "No se encontró el adaptador de aparcado A06");

const bloqueDominio = fuente.slice(inicioDominio, finDominio).trim();
assert.match(bloqueDominio, /leerContextoCuentaA02\(empresaId, localActivoId\)/, "Debe leer la cuenta enlazada al terminal");
assert.match(bloqueDominio, /localStorage\.removeItem\(claveContexto\)/, "Debe retirar únicamente el enlace local de la cuenta");
assert.match(bloqueDominio, /localStorage\.getItem\(claveContexto\) !== null/, "Debe verificar que el enlace local se eliminó");
assert.doesNotMatch(bloqueDominio, /supabase|\.rpc\(|CANCELAR|cobrar|pago/i, "Aparcar no debe mutar pedido, cocina ni cobros");

const clave = "la_suite_a02_1_ultima_cuenta_v1:empresa-qa:local-qa";
const contexto = {
  cuentaId: "589e2885-f54c-4076-812a-71f57f02d9e7",
  pedidoId: "11111111-2222-4333-8444-555555555555",
  cuentaVersion: 3,
  pedidoVersion: 4,
  pedidoEstado: "ABIERTO",
  currencyCode: "EUR",
  modalidad: "BARRA",
  operatingDay: "2026-10-23"
};
const datos = new Map([[clave, JSON.stringify(contexto)], ["otra-clave", "conservar"]]);
const almacenamiento = {
  getItem: (key) => datos.has(key) ? datos.get(key) : null,
  removeItem: (key) => datos.delete(key)
};
const crearAparcado = new Function(
  "localActivoId",
  "empresaDelLocalActivo",
  "leerContextoCuentaA02",
  "claveUltimaCuentaA02",
  "localStorage",
  "errorRpcA02",
  `return (${bloqueDominio});`
);
const aparcar = crearAparcado(
  "local-qa",
  { id: "empresa-qa" },
  () => datos.has(clave) ? JSON.parse(datos.get(clave)) : null,
  (empresaId, localId) => `la_suite_a02_1_ultima_cuenta_v1:${empresaId}:${localId}`,
  almacenamiento,
  (error) => String(error?.message || error)
);

const resultado = aparcar();
assert.equal(resultado.ok, true);
assert.equal(resultado.cuentaId, contexto.cuentaId);
assert.equal(resultado.pedidoId, contexto.pedidoId);
assert.equal(datos.has(clave), false, "La cuenta debe quedar desvinculada de este terminal");
assert.equal(datos.get("otra-clave"), "conservar", "No debe borrar otros datos locales");
assert.deepEqual(aparcar(), { ok: false, error: "No hay una cuenta operativa para aparcar." }, "Repetir el aparcado debe ser inocuo");

const inicioUi = fuente.indexOf("  async function aparcarCuentaActualA06()");
const finUi = fuente.indexOf("\n  (0, import_react4.useEffect)(() => {", inicioUi);
assert.ok(inicioUi >= 0 && finUi > inicioUi, "No se encontró el controlador visible de aparcado");
const bloqueUi = fuente.slice(inicioUi, finUi);
assert.match(bloqueUi, /estadoBorradorA06\?\.estado === "ACTIVO" && carrito\.length > 0/, "El borrador local debe bloquear el aparcado");
assert.match(bloqueUi, /await Promise\.resolve\(aparcarCuentaA06\(\)\)/, "Debe ejecutar el adaptador de aparcado");
assert.match(bloqueUi, /setPedidoOperativoA05\(null\)/, "Debe limpiar la cuenta activa del terminal");
assert.match(bloqueUi, /await refrescarCuentasRecuperablesA06\(\)/, "La cuenta aparcada debe aparecer inmediatamente en el listado");
assert.match(fuente, /Aparcar solo desvincula esta cuenta del terminal\. No cancela ni modifica el pedido, cocina o los cobros\./);
assert.match(fuente, /if \(carrito\.length !== 0\) return;[\s\S]*ERROR_BORRADOR_RECUPERACION_A06/, "El aviso de borrador debe desaparecer al vaciarse el carrito");

console.log("PLAN_MAESTRO_ETAPA5_APARCAR_CUENTA_CONTRACT_OK=1");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const fuente = readFileSync(new URL("../../fuente.js", import.meta.url), "utf8");
const inicio = fuente.indexOf("function AppConSesion() {");
const fin = fuente.indexOf("var rutaHash =", inicio);
assert.ok(inicio >= 0 && fin > inicio);

const fases = [];
const efectos = [];
const temporizadores = [];
const estado = { mfa: "lista", comprobaciones: 0, sincronizaciones: 0 };
let callbackAuth;
let pausaMfa;
const sesion = (token) => ({ access_token: token, user: { id: "usuario-qa" } });
const supabase = {
  auth: {
    async getSession() {
      return { data: { session: sesion("token-original") } };
    },
    onAuthStateChange(callback) {
      callbackAuth = callback;
      return { data: { subscription: { unsubscribe() { callbackAuth = undefined; } } } };
    }
  }
};

const react = {
  useState(initial) {
    if (initial === "comprobando") return [initial, (fase) => fases.push(fase)];
    return [initial, () => {}];
  },
  useEffect(effect) { efectos.push(effect); },
  useRef(current) { return { current }; },
  default: { createElement() { return {}; } }
};
vm.runInNewContext(fuente.slice(inicio, fin) + "\nAppConSesion();", {
  import_react4: react,
  window: {
    conectarNube: async () => true,
    __nubeCliente: supabase,
    subirPendientes: async () => { estado.sincronizaciones++; }
  },
  async evaluarMfaSesion() {
    estado.comprobaciones++;
    if (pausaMfa) await pausaMfa;
    return { modo: estado.mfa === "lista" ? null : estado.mfa };
  },
  setTimeout(callback) { temporizadores.push(callback); }
});

const esperar = () => new Promise(setImmediate);
const desmontar = efectos[1]();
await esperar();
assert.deepEqual(fases, ["comprobando-mfa", "dentro"]);

function evento(nombre, valor) {
  assert.equal(callbackAuth(nombre, valor), undefined, "Auth no debe esperar trabajo del callback");
  assert.ok(temporizadores.length);
  temporizadores.shift()();
}

for (let i = 0; i < 25; i++) {
  evento(i === 0 ? "INITIAL_SESSION" : "SIGNED_IN", sesion("token-original"));
}
await esperar();
assert.equal(estado.comprobaciones, 1);
assert.equal(estado.sincronizaciones, 1);
assert.deepEqual(fases, ["comprobando-mfa", "dentro"]);

let continuarMfa;
pausaMfa = new Promise((resolve) => { continuarMfa = resolve; });
estado.mfa = "challenge";
evento("TOKEN_REFRESHED", sesion("token-renovado"));
evento("SIGNED_IN", sesion("token-renovado"));
assert.equal(estado.comprobaciones, 2);
continuarMfa();
await esperar();
assert.equal(fases.at(-1), "mfa");
assert.equal(estado.sincronizaciones, 1);

pausaMfa = new Promise((resolve) => { continuarMfa = resolve; });
estado.mfa = "lista";
evento("SIGNED_IN", sesion("token-nuevo"));
evento("SIGNED_OUT", null);
continuarMfa();
await esperar();
assert.equal(fases.at(-1), "login");
assert.equal(estado.sincronizaciones, 1);

desmontar();
assert.equal(callbackAuth, undefined);
console.log("ARRANQUE_SESION=PASS · repetición, desafío MFA, salida con validación pendiente y desmontaje");

// Arranque · el canal previo a la barrera no puede tener huecos.
//
// `owner-bootstrap-prelock.js` deja pasar por el canal nativo solo las RPC de
// su lista blanca, y lanza «RPC bootstrap no permitido» para cualquier otra.
// Es una barrera deliberada y está bien que exista.
//
// El problema es la deriva: quien añade una llamada nueva al arranque puede no
// acordarse de añadirla a la lista. Eso pasó de verdad el 17/11/2026 con
// `mfa_politica_leer`, que entró con la MFA opcional y nunca se anotó. Medido
// en QA entrando con una cuenta de Camarero/a recién creada: la aplicación no
// abría y mostraba «Instalación bloqueada de forma segura · RPC bootstrap no
// permitido», una pantalla de instalador para alguien que solo quería tomar
// comandas.
//
// Lo peor es que el propio código ya había previsto el caso de que la RPC no
// exista todavía en el servidor —la migración de MFA opcional sigue sin
// aplicarse en QA— y en ese caso falla cerrado, exigiendo el segundo factor.
// Pero ese cuidado no llegaba a ejercerse nunca, porque la llamada moría antes
// de salir del navegador y el error no se parecía a un «función no encontrada».
//
// Y solo afectaba a quien NO tiene factor inscrito: con factor, el arranque ni
// pregunta. Es decir, pasaba desapercibido para las cuentas veteranas y
// golpeaba exactamente a las recién creadas.
//
// Este contrato cierra la deriva: toda RPC que el arranque llame por ese canal
// tiene que estar en la lista.

import fs from "node:fs";
import assert from "node:assert/strict";

const prelock = fs.readFileSync("owner-bootstrap-prelock.js", "utf8");
const FICHEROS_ARRANQUE = [
  "owner-bootstrap-prelock.js",
  "owner-bootstrap-post-reset.js",
];

// ---- La lista blanca, leída del propio fichero. ----
const ini = prelock.indexOf("var RPC_PERMITIDOS = {");
assert.ok(ini >= 0, "no encuentro la lista blanca del canal de bootstrap");
const fin = prelock.indexOf("};", ini);
assert.ok(fin > ini, "no encuentro el final de la lista blanca");
const bloque = prelock.slice(ini, fin);
const permitidas = new Set(
  (bloque.match(/^\s*([a-z0-9_]+):\s*true,?\s*$/gm) || []).map((l) => l.trim().split(":")[0])
);

assert.ok(permitidas.size >= 10, `la lista blanca parece vacía o mal leída (${permitidas.size} entradas)`);
assert.ok(permitidas.has("obtener_estado_instalacion"), "la lista leída tiene que ser la del canal de bootstrap");

// ---- Las RPC que el arranque llama de verdad por ese canal. ----
const llamadas = new Set();
for (const ruta of FICHEROS_ARRANQUE) {
  const src = fs.readFileSync(ruta, "utf8");
  for (const m of src.matchAll(/(?:rpcP4|__laOwnerBootstrapRpc)\(\s*"([a-z0-9_]+)"/g)) {
    llamadas.add(m[1]);
  }
}

assert.ok(llamadas.size >= 3, `esperaba varias llamadas por el canal y encontré ${llamadas.size}`);
assert.ok(llamadas.has("mfa_politica_leer"), "mfa_politica_leer sigue llamándose por el canal; si deja de hacerlo, actualiza este contrato");

const huecos = [...llamadas].filter((n) => !permitidas.has(n));
assert.deepEqual(
  huecos,
  [],
  `el arranque llama a ${huecos.join(", ")} por el canal previo a la barrera y no está${huecos.length === 1 ? "" : "n"} en RPC_PERMITIDOS: ` +
    "la llamada no saldría del navegador y la aplicación se quedaría en «Instalación bloqueada de forma segura»"
);

console.log("ARRANQUE_CANAL_SIN_HUECOS=PASS");

// ---- Y el cuidado que ya existía sigue existiendo: si el servidor no tiene
// todavía la política, se falla cerrado, no abierto. ----
{
  const post = fs.readFileSync("owner-bootstrap-post-reset.js", "utf8");
  const i = post.indexOf("async function mfaExigidaPorElServidorBootstrap(");
  assert.ok(i >= 0, "no encuentro mfaExigidaPorElServidorBootstrap");
  const cuerpo = post.slice(i, post.indexOf("\n  }\n", i));
  assert.match(
    cuerpo,
    /could not find the function\|PGRST202\|HTTP 404/i,
    "sin la migración aplicada, la ausencia de la función tiene que seguir fallando cerrado"
  );
  assert.match(cuerpo, /return true;/, "y fallar cerrado significa seguir exigiendo el segundo factor");
  console.log("ARRANQUE_SIN_POLITICA_FALLA_CERRADO=PASS");
}

console.log("Arranque (canal de bootstrap) — la lista blanca cubre lo que se llama: contrato OK");

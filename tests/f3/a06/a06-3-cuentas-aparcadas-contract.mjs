// A06.3 · tpv-09: «Recuperar cuenta y tickets aparcados».
//
// La pantalla no existía. El servidor sí sabía de esto desde siempre:
// abc_listar_cuentas_recuperables devuelve, por local, todo lo que sigue
// abierto, con su modalidad, su mesa, cuándo se abrió, cuándo se tocó por
// última vez, cuánto suma y si se puede reanudar. Hasta ahora esa lectura solo
// se usaba dentro del reparto (A08), y filtrada a destinos compatibles, así que
// nada en el programa enseñaba lo que había quedado abierto.
//
// Medido en QA antes de construir nada, preguntándoselo al servidor: 80 cuentas
// abiertas en un solo local, 258,67 EUR en total, repartidas por 17 días
// operativos desde el 3 de octubre, y 79 de ellas de días ya cerrados. Dinero
// abierto e invisible.
//
// Este contrato fija tres cosas: que la lista se le pide al servidor y no se
// deduce aquí, que quien decide si una cuenta se puede retomar es el servidor,
// y que lo que no se puede retomar no se ofrece ni se disimula.

import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const bundle = fs.readFileSync("fuente.js", "utf8");
const recuperado = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");

function entre(texto, desde, hasta, quien) {
  const ini = texto.indexOf(desde);
  assert.ok(ini >= 0, `${quien}: no encuentro ${desde}`);
  const fin = texto.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, `${quien}: no encuentro el final ${hasta}`);
  return texto.slice(ini, fin);
}

for (const [nombre, src] of [["bundle", bundle], ["fuente recuperado", recuperado]]) {
  const lectura = entre(src, "  async function listarCuentasAparcadasA06(", "  async function listarCuentasRepartoA08(", nombre);

  // ---- 1. La lista la lleva el servidor. ----
  assert.match(lectura, /supabase\.rpc\("abc_listar_cuentas_recuperables"/, `${nombre}: la lista se le pide al servidor`);
  // Esto fallo al pulsarlo: contextoTerminalA02 no devuelve operatingDay, y
  // Supabase descarta las claves undefined, asi que la llamada salia sin ese
  // argumento y el servidor respondia que no conocia esa funcion.
  assert.match(lectura, /supabase\.rpc\("abc_obtener_dia_operativo_local"/, `${nombre}: el día operativo se le pregunta al servidor`);
  assert.match(lectura, /if \(!operatingDay\) throw new Error\("operating_day_servidor_ausente"\)/, `${nombre}: y sin día no se llama, en vez de llamar con un hueco`);
  assert.match(lectura, /p_operating_day: operatingDay,/, `${nombre}: el día que se manda es ese`);
  assert.doesNotMatch(lectura, /terminal\.operatingDay/, `${nombre}: contextoTerminalA02 no tiene ese campo; leerlo de ahí deja el argumento en undefined`);
  assert.doesNotMatch(lectura, /leerContextoCuentaA02/, `${nombre}: esta pantalla tiene que abrirse sin ninguna cuenta en la mano, así que no puede depender del contexto persistido`);
  assert.match(lectura, /if \(!data\?\.ok \|\| !Array\.isArray\(data\.cuentas\)\) throw new Error\("cuentas_aparcadas_respuesta_invalida"\)/, `${nombre}: una respuesta que no se entiende no se da por buena`);

  // ---- 2. Quién puede retomarse lo dice el servidor, no esta pantalla. ----
  assert.match(lectura, /retomable: String\(cuenta\.estado \|\| ""\) === "ABIERTA"/, `${nombre}: primera condición del servidor`);
  assert.match(lectura, /&& cuenta\.reanudable_mismo_dia !== false/, `${nombre}: segunda condición del servidor`);
  assert.match(lectura, /&& cuenta\.requires_operating_day_resolution !== true/, `${nombre}: tercera condición del servidor`);
  assert.match(lectura, /&& String\(cuenta\.opened_operating_day \|\| ""\) === String\(operatingDay\)/, `${nombre}: y el día tiene que ser el de hoy`);

  // ---- 3. Sin conexión se dice sin fingir, y sin alarmar de más. ----
  assert.match(lectura, /La lista de cuentas abiertas la lleva el servidor/, `${nombre}: se dice de quién es la lista`);
  assert.match(lectura, /Ninguna se ha perdido: siguen all\\xED\./, `${nombre}: y que no se ha perdido nada, que es lo que de verdad preocupa`);

  // ---- 4. Lo que no se puede retomar no se ofrece. ----
  const pintura = entre(src, "  function renderCuentasAparcadasA06(", "  function renderRepartoProductosA08(", nombre);
  assert.match(pintura, /cuenta\.retomable\s*\n?\s*\? .*"Retomar"/s, `${nombre}: el botón solo sale si el servidor dice que se puede`);
  assert.match(pintura, /: CE?.*"D\\xEDa cerrado"/s, `${nombre}: y si no, se dice por qué en vez de dejar un hueco`);
  assert.match(pintura, /son de d\\xEDas operativos ya cerrados/, `${nombre}: el resumen cuenta cuántas son`);
  assert.match(pintura, /tampoco se cierran solas: esa resoluci\\xF3n la hace el servidor/, `${nombre}: y no promete que se arreglen desde aquí`);
  assert.doesNotMatch(pintura, /Recuperar todas|Cerrar todas/, `${nombre}: nada de acciones masivas que el servidor no ofrece`);

  // ---- 5. Retomar no se da por hecho. ----
  const retomar = entre(src, "  async function retomarCuentaAparcadaA06(", "  function dondeEstaCuentaA06(", nombre);
  assert.match(retomar, /const resultado = await recuperarCuentaA06\(\{/, `${nombre}: hay que quedarse con lo que devuelve`);
  assert.match(retomar, /if \(!resultado\?\.ok\) \{/, `${nombre}: y mirarlo`);
  assert.match(retomar, /No se ha podido retomar la cuenta\. No se ha tocado nada\./, `${nombre}: cuando falla, se dice que no se tocó nada`);
  assert.match(retomar, /setPedidoOperativoA05\(resultado\)/, `${nombre}: y cuando sale bien, la cuenta queda abierta de verdad`);
  const antesDelFallo = retomar.slice(0, retomar.indexOf("if (!resultado?.ok)"));
  assert.doesNotMatch(antesDelFallo, /setPedidoOperativoA05|setMensajeAparcadasA06\("Cuenta retomada/, `${nombre}: no se celebra antes de saber si salió bien`);

  // ---- 6. Cableado completo, de la lógica a la pantalla. ----
  assert.ok(src.includes("respuestaErrorA06, listarCuentasAparcadasA06, ensayarCierreSesionCajaC12 };"), `${nombre}: la lógica la entrega`);
  assert.ok(src.includes("moverCantidadLineaCuentaA08, listarCuentasAparcadasA06 } = crearLogicaVenta("), `${nombre}: la aplicación la recibe`);
  assert.ok(src.includes("cargarSalaDestino: () => cargarMapaSalaA07({ paraPanel: true }), listarCuentasAparcadasA06 }"), `${nombre}: y se la pasa al TPV`);
  assert.ok(src.includes("mesaDestino, cargarSalaDestino, listarCuentasAparcadasA06 = null }"), `${nombre}: el TPV la declara`);
  assert.ok(src.includes("renderCuentasAparcadasA06(), renderSalaA07(), renderRepartoProductosA08()"), `${nombre}: y la pinta, delante del plano de sala`);
}

// ---- 7. La etiqueta del sitio, ejecutada de verdad. ----
{
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(
    bundle.slice(bundle.indexOf("var MODALIDADES_ETIQUETA_A02 ="), bundle.indexOf("\n", bundle.indexOf("var MODALIDADES_ETIQUETA_A02 ="))) + "\n" +
    entre(bundle, "  function dondeEstaCuentaA06(", "  function renderCuentasAparcadasA06(", "bundle"),
    ctx
  );

  assert.equal(
    ctx.dondeEstaCuentaA06({ ubicacion: { mesa_nombre: "Mesa QA-A1-01", zona_nombre: "Sala QA-A1" }, modalidad: "MESA" }),
    "Mesa QA-A1-01 · Sala QA-A1",
    "con mesa, se dice la mesa y su zona"
  );
  assert.equal(
    ctx.dondeEstaCuentaA06({ ubicacion: { mesa_nombre: "Mesa suelta" }, modalidad: "MESA" }),
    "Mesa suelta",
    "y sin zona, solo la mesa, sin un separador colgando"
  );
  // 72 de las 80 cuentas abiertas de QA son de barra y no tienen mesa: si esta
  // rama fallara, la pantalla enseñaría 72 filas sin nombre.
  assert.equal(ctx.dondeEstaCuentaA06({ modalidad: "BARRA" }), "Barra", "sin mesa, se dice la modalidad en castellano");
  assert.equal(ctx.dondeEstaCuentaA06({ modalidad: "TAKEAWAY" }), "Para llevar");
  assert.equal(ctx.dondeEstaCuentaA06({ modalidad: "TERRAZA" }), "Terraza");
  assert.equal(ctx.dondeEstaCuentaA06({}), "Sin sitio", "y si el servidor no dice nada, se dice eso, no una cadena vacía");
  assert.equal(ctx.dondeEstaCuentaA06({ modalidad: "LO_QUE_SEA" }), "LO_QUE_SEA", "una modalidad que no conocemos se enseña tal cual en vez de desaparecer");
}

console.log("A06_3_LISTA_DEL_SERVIDOR=PASS");
console.log("A06_3_QUIEN_DECIDE_ES_EL_SERVIDOR=PASS");
console.log("A06_3_LO_QUE_NO_SE_RETOMA_NO_SE_OFRECE=PASS");
console.log("A06_3_RETOMAR_NO_SE_DA_POR_HECHO=PASS");
console.log("A06_3_CABLEADO_COMPLETO=PASS");
console.log("A06_3_LA_ETIQUETA_DEL_SITIO_NUNCA_QUEDA_VACIA=PASS");
console.log("A06.3 (tpv-09, cuentas abiertas y aparcadas) — contrato OK");

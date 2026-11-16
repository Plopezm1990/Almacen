// A08.3 · tpv-26: «Unir mesas».
//
// La nota de la matriz decía «sin pantalla, la capacidad ABC_CUENTA_UNIR sí
// existe en el catálogo de permisos». Se quedaba corta, y yo me quedé corto
// igual la primera vez: miré qué RPC llamaba el cliente, no encontré ninguna de
// unir, y di por hecho que la operación no existía en el servidor.
//
// Existe. `public.abc_unir_cuentas` está definida en
// supabase/migrations/20260927203000_abc_f3_a08_2_payment_interlock.sql desde
// septiembre, con once motivos de negativa escritos uno a uno, y el cliente no
// la había llamado nunca. El permiso estaba, la operación estaba, y lo único
// que faltaba era la pantalla.
//
// Leído del cuerpo de la función, esto es lo que hace: pasa los repartos
// activos de la cuenta ORIGEN a la DESTINO, cierra la origen, anota una
// relación FUSION, traslada la asignación de mesa y SUMA los comensales. Y solo
// lo hace el mismo día operativo, en la misma moneda, con las dos cuentas
// abiertas, sin venta fiscal emitida, sin cuotas de importe activas, sin pedido
// editable ni líneas a medias en la origen, y —esto es lo menos evidente— solo
// si las dos están en la MISMA mesa.

import fs from "node:fs";
import assert from "node:assert/strict";

const bundle = fs.readFileSync("fuente.js", "utf8");
const recuperado = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const migracion = fs.readFileSync("supabase/migrations/20260927203000_abc_f3_a08_2_payment_interlock.sql", "utf8");

function entre(texto, desde, hasta, quien) {
  const ini = texto.indexOf(desde);
  assert.ok(ini >= 0, `${quien}: no encuentro ${desde}`);
  const fin = texto.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, `${quien}: no encuentro el final ${hasta}`);
  return texto.slice(ini, fin);
}

// Los once motivos de negativa, sacados de la propia migración: si el servidor
// añade uno nuevo, este contrato se entera y exige su traducción.
const NEGATIVAS = [...new Set(
  (entre(migracion, "CREATE OR REPLACE FUNCTION public.abc_unir_cuentas(", "end $function$;", "migración")
    .match(/raise exception '([a-z_]+)'/g) || []).map((m) => m.replace(/.*'([a-z_]+)'.*/, "$1"))
)];

assert.ok(NEGATIVAS.includes("cuentas_unir_mesas_distintas"), "la migración leída tiene que ser la de unir cuentas");
assert.ok(NEGATIVAS.length >= 9, `esperaba al menos nueve motivos de negativa y encontré ${NEGATIVAS.length}`);

for (const [nombre, src] of [["bundle", bundle], ["fuente recuperado", recuperado]]) {
  const adaptador = entre(src, "  async function unirCuentasA08(", "  async function listarCuentasAparcadasA06(", nombre);

  // ---- 1. Se llama a la función real, con sus once argumentos. ----
  assert.match(adaptador, /rpcA02ConRecuperacion\(supabase, "abc_unir_cuentas", \{/, `${nombre}: se llama a la función del servidor`);
  for (const p of ["p_operation_id", "p_empresa_id", "p_local_id", "p_cuenta_origen_id", "p_cuenta_destino_id", "p_motivo", "p_expected_origen_version", "p_expected_destino_version", "p_terminal_id", "p_session_id", "p_operating_day"]) {
    assert.match(adaptador, new RegExp(p + ":"), `${nombre}: falta el argumento ${p}, y Supabase descarta las claves undefined`);
  }

  // ---- 2. La dirección importa: la que se cierra es la ORIGEN. ----
  assert.match(adaptador, /p_cuenta_origen_id: origenId,/, `${nombre}: la cuenta elegida es la que se funde y se cierra`);
  assert.match(adaptador, /p_cuenta_destino_id: contexto\.cuentaId,/, `${nombre}: la cuenta actual es la que sobrevive`);
  assert.match(adaptador, /if \(String\(contexto\.cuentaId\) === origenId\) throw new Error\("cuentas_unir_parametros_invalidos"\)/, `${nombre}: no se une una cuenta consigo misma`);

  // ---- 3. Idempotencia y versiones esperadas, como su hermana de reparto. ----
  assert.match(adaptador, /const operationId = "a08\.2\.unir:" \+ operationHash;/, `${nombre}: el id de operación es determinista, así que un reintento no duplica la fusión`);
  assert.match(adaptador, /versionServidorA02\(expectedOrigenVersion, "a08\.unir\.cuenta_origen_version"\)/, `${nombre}: versión esperada de la origen`);
  assert.match(adaptador, /versionServidorA02\(expectedDestinoVersion, "a08\.unir\.cuenta_destino_version"\)/, `${nombre}: versión esperada de la destino`);

  // ---- 4. El motivo se pide aquí, no se deja que lo niegue el servidor. ----
  assert.match(adaptador, /if \(!razon\) return \{ ok: false, error: "Escribe el motivo/, `${nombre}: el motivo es obligatorio y se pide antes de llamar`);
  assert.match(adaptador, /queda guardado con la fusi\\xF3n/, `${nombre}: y se dice para qué sirve`);

  // ---- 5. Sin conexión se dice sin fingir. ----
  assert.match(adaptador, /Unir cuentas lo hace el servidor/, `${nombre}: se dice de quién es la operación`);
  assert.match(adaptador, /No se ha tocado nada\./, `${nombre}: y que no se ha tocado nada`);

  // ---- 6. Las once negativas del servidor, todas traducidas. ----
  const traductor = entre(src, "  function errorRpcA02(", "\n  }\n", nombre);
  for (const codigo of NEGATIVAS) {
    assert.ok(
      traductor.includes(codigo) || /version_conflict/.test(codigo),
      `${nombre}: el servidor puede responder «${codigo}» y nadie lo traduce; saldría el código crudo en pantalla`
    );
  }
  assert.match(traductor, /El servidor solo une cuentas de la misma mesa/, `${nombre}: la negativa menos evidente hay que explicarla, no solo nombrarla`);
  assert.match(traductor, /ya tiene una venta fiscal emitida/, `${nombre}: y la fiscal, decir por qué no se puede`);

  // ---- 7. La pantalla dice lo que va a pasar antes de pulsar. ----
  const pintura = entre(src, "  function renderUnirCuentasA08(", "  function renderRepartoProductosA08(", nombre);
  assert.match(pintura, /se cierra y sus /, `${nombre}: que la otra cuenta se cierra`);
  assert.match(pintura, /Los comensales de las dos se suman/, `${nombre}: que los comensales se suman, que es lo que hace el servidor`);
  assert.match(pintura, /No se deshace desde aqu\\xED\./, `${nombre}: y que no hay vuelta atrás desde esta pantalla`);
  assert.match(pintura, /solo del mismo d\\xEDa, en la misma moneda y en la misma mesa/, `${nombre}: las condiciones del servidor, dichas antes de intentarlo`);
  assert.match(pintura, /disabled: uniendoCuentasA08 \|\| !cuentaAUnirA08 \|\| !motivoUnirA08\.trim\(\)/, `${nombre}: sin cuenta elegida y sin motivo, el botón no se ofrece`);

  // ---- 8. El resultado no se da por hecho. ----
  const confirmar = entre(src, "  async function confirmarUnirCuentasA08(", "  function renderUnirCuentasA08(", nombre);
  assert.match(confirmar, /const resultado = await unirCuentasA08\(/, `${nombre}: hay que quedarse con lo que devuelve`);
  assert.match(confirmar, /if \(!resultado\?\.ok\) \{/, `${nombre}: y mirarlo`);
  assert.match(confirmar, /No se han unido las cuentas\. No se ha tocado nada\./, `${nombre}: cuando falla, se dice`);
  const antesDelFallo = confirmar.slice(0, confirmar.indexOf("if (!resultado?.ok)"));
  assert.doesNotMatch(antesDelFallo, /setMensajeUnirA08\("Cuentas unidas/, `${nombre}: no se celebra antes de saber si salió bien`);

  // ---- 9. Cableado y pintura. ----
  assert.ok(src.includes("respuestaErrorA06, listarCuentasAparcadasA06, unirCuentasA08, ensayarCierreSesionCajaC12 };"), `${nombre}: la lógica la entrega`);
  assert.ok(src.includes("listarCuentasAparcadasA06, unirCuentasA08 } = crearLogicaVenta("), `${nombre}: la aplicación la recibe`);
  assert.ok(src.includes("listarCuentasAparcadasA06, unirCuentasA08 }"), `${nombre}: y se la pasa al TPV`);
  assert.ok(src.includes("renderRepartoProductosA08(), renderUnirCuentasA08()"), `${nombre}: y se pinta junto al reparto, que es su pareja natural`);
}

console.log("A08_3_SE_LLAMA_A_LA_FUNCION_REAL=PASS");
console.log("A08_3_LA_QUE_SE_CIERRA_ES_LA_ELEGIDA=PASS");
console.log("A08_3_UN_REINTENTO_NO_DUPLICA=PASS");
console.log("A08_3_LAS_ONCE_NEGATIVAS_SE_ENTIENDEN=PASS");
console.log("A08_3_SE_DICE_LO_QUE_VA_A_PASAR=PASS");
console.log("A08_3_EL_RESULTADO_NO_SE_DA_POR_HECHO=PASS");
console.log("A08.3 (tpv-26, unir cuentas) — contrato OK");

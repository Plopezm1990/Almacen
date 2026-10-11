import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SIN_ACCESO_QA, LECTURAS_DIRECTAS_CONOCIDAS } from "./lib/tablas-sin-acceso-qa.mjs";

// Contrato estático de la lectura del estado del cobro del TPV (leerEstadoCobroF4), arreglo del 3/10/2026:
//  - el navegador no consulta directamente pago_intentos (la migración ACL parity le quitó el acceso); los intentos llegan de
//    abc_estado_pago_mixto_cuenta, que devuelve exactamente los campos que la pantalla usaba;
//  - el bloque es idéntico en `fuente.js` y en `source-recovery/fuente-recuperado.js`;
//  - ninguna lectura directa de la aplicación apunta a una tabla que el navegador no puede leer (lista comprobada en QA), salvo la conocida y anotada;
//  - el contrato de ejecución existe y cubre los casos exigidos.
// CFG_COBRO_FUENTE_RECUPERADA y CFG_COBRO_FUENTE_BUNDLE permiten probar variantes rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");
const recuperado = lf(process.env.CFG_COBRO_FUENTE_RECUPERADA ? await readFile(process.env.CFG_COBRO_FUENTE_RECUPERADA, "utf8") : await read("source-recovery/fuente-recuperado.js"));
const bundle = lf(process.env.CFG_COBRO_FUENTE_BUNDLE ? await readFile(process.env.CFG_COBRO_FUENTE_BUNDLE, "utf8") : await read("fuente.js"));

function entre(texto, ini, fin, nombre) {
  assert.equal(texto.split(ini).length, 2, `${nombre}: una única aparición de «${ini.slice(0, 60)}»`);
  const i = texto.indexOf(ini);
  const j = texto.indexOf(fin, i + ini.length);
  assert.ok(j > i, `${nombre}: no se encuentra el final «${fin.slice(0, 50)}»`);
  return texto.slice(i, j);
}
// 1. El bloque de lectura es idéntico en los dos archivos.
const lectura = (t, nombre) => {
  const i = t.indexOf("async function leerEstadoCobroF4()");
  assert.ok(i >= 0, nombre + ": no está leerEstadoCobroF4");
  assert.equal(t.split("async function leerEstadoCobroF4()").length, 2, nombre + ": una única leerEstadoCobroF4");
  const j = t.indexOf("\n  async function ", i + 10);
  assert.ok(j > i, nombre + ": no se encuentra el final de leerEstadoCobroF4");
  return t.slice(i, j);
};
const R = lectura(recuperado, "fuente recuperado");
const B = lectura(bundle, "bundle");
assert.equal(R, B, "leerEstadoCobroF4 es idéntica en el bundle y en el fuente recuperado");

// 2. Sin lectura directa de pago_intentos; los intentos vienen del servidor.
assert.doesNotMatch(R, /\.from\("pago_intentos"\)/, "leerEstadoCobroF4 no lee pago_intentos directamente");
assert.doesNotMatch(R.replace(/\/\/[^\n]*/g, ""), /pago_intentos/, "leerEstadoCobroF4 no nombra pago_intentos más que en comentarios");
assert.match(R, /await supabase\.rpc\("abc_estado_pago_mixto_cuenta", \{\s+p_empresa_id: empresaId,\s+p_local_id: localActivoId,\s+p_cuenta_id: contextoCuenta\.cuentaId\s+\}\);\s+if \(detalleB05Error\) throw detalleB05Error;/, "los intentos se piden a abc_estado_pago_mixto_cuenta y su error se propaga");
assert.match(R, /let intentos = \[\];\s+let incidencias = \[\];/, "los intentos empiezan vacíos (sin consulta intermedia)");
assert.match(R, /if \(Array\.isArray\(detalleB05\?\.intentos\)\) intentos = detalleB05\.intentos;/, "los intentos son los que manda el servidor");
assert.match(R, /const resumenServidor = detalleB05 \|\| resumen;/, "el estado final sale de la función de pago mixto (con el resumen como respaldo)");
assert.match(R, /cobroIncierto: intentos\.some\(\(x3\) => \["PENDIENTE", "AUTORIZADO", "DESCONOCIDO"\]\.includes\(String\(x3\.estado \|\| ""\)\)\)/, "cobro incierto = algún intento pendiente, autorizado o desconocido");
assert.match(R, /\.from\("checkouts"\)/, "los cobros se siguen leyendo de checkouts (tabla permitida)");
assert.match(R, /\.from\("pagos"\)/, "los pagos se siguen leyendo de pagos (tabla permitida)");

// 3. El servidor devuelve en `intentos` los campos que la pantalla usaba (los que pedía la consulta directa).
const mig = lf(await read("supabase/migrations/20260929220000_abc_f4_b05_mixed_payments.sql"));
const iIni = mig.indexOf("'id',i.id,'pago_id',i.pago_id");
assert.ok(iIni > 0, "la función del servidor construye los intentos");
const iFin = mig.indexOf("from public.pago_intentos i", iIni);
const construccion = mig.slice(iIni, iFin);
for (const campo of ["id", "pago_id", "estado", "provider_code", "provider_reference", "requested_amount", "authorized_amount", "captured_amount", "settled_amount", "authorization_status", "capture_status", "settlement_status", "started_at", "resolved_at"])
  assert.ok(construccion.includes(`'${campo}',i.${campo}`), "abc_estado_pago_mixto_cuenta devuelve el campo " + campo);
assert.match(mig, /'intentos',v_intentos/, "y lo devuelve en la clave «intentos»");
assert.match(mig, /grant execute on function public\.abc_estado_pago_mixto_cuenta\(text,text,uuid\)\s+to authenticated/, "el navegador puede llamar a esa función");

// 4. La causa: la migración ACL parity le quita al navegador la lectura de pago_intentos.
const acl = lf(await read("supabase/migrations/20260924004000_abc_f2_m04d_acl_parity.sql"));
const concesion = acl.slice(acl.indexOf("grant select"), acl.indexOf("to authenticated", acl.indexOf("grant select")));
assert.ok(!concesion.includes("pago_intentos"), "la migración ACL parity no le da lectura a pago_intentos al navegador");
assert.match(acl, /revoke all privileges\s+on table[\s\S]*?public\.pago_intentos[\s\S]*?from anon, authenticated/, "la migración ACL parity se la quita");

// 5. Ninguna lectura directa de la aplicación apunta a una tabla que el navegador no puede leer (salvo la conocida y anotada).
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  const encontradas = {};
  for (const m of t.matchAll(/\.from\("([a-z_0-9]+)"\)/g)) if (SIN_ACCESO_QA.includes(m[1])) encontradas[m[1]] = (encontradas[m[1]] || 0) + 1;
  assert.deepEqual(encontradas, LECTURAS_DIRECTAS_CONOCIDAS, `${nombre}: lecturas directas a tablas sin permiso (esperadas solo las conocidas): ${JSON.stringify(encontradas)}`);
}

// 6. El contrato de ejecución existe y cubre los casos exigidos.
const vivo = await read("tests/cfg/cobro-lectura-runtime.mjs");
for (const marca of ["C1 tras un cobro en efectivo confirmado", "C3 el pago y el intento llegan con todos sus datos", "C4b el efectivo recibido, el cambio, lo reservado", "C5 el navegador no consulta ninguna tabla sin permiso", "C6 los intentos se piden al servidor",
  "D1 un intento pendiente de tarjeta", "D2 intento ", "E1 varios intentos", "F1 si el servidor no manda la lista de intentos", "G1 si el servidor rechaza la lectura", "G2 si falla la lectura de los pagos", "H1 sin conexión"])
  assert.ok(vivo.includes(marca), "falta el caso de ejecución: " + marca);

console.log("cobro-lectura-static-contract: OK");

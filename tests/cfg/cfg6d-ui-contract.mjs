import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático de pantalla de la PIEZA 6d (cierre de caja con diferencia):
//  - el cierre localiza la sesión del terminal en cualquier estado del cierre y toma el día operativo del servidor;
//  - consultar, registrar el motivo y decidir (aprobar o rechazar) una diferencia de caja, con los nombres y parámetros
//    exactos de las funciones del servidor (migraciones de las piezas 2 y 6d);
//  - la pantalla de cierre de «Cocina A10»: recupera el estado del servidor, pide el motivo, deja decidir solo al Propietario
//    y no ofrece «Finalizar cierre» mientras haya bloqueos de diferencia.
// Lee `source-recovery/fuente-recuperado.js` y `fuente.js` (deben llevar exactamente lo mismo; la paridad completa de la
// lógica la exige además `python3 source-recovery/recuperar_candidato.py --check`). CFG6D_FUENTE_RECUPERADA y
// CFG6D_FUENTE_BUNDLE permiten probar variantes rotas en las comprobaciones de mutantes. La conducta la prueba
// tests/cfg/cfg6d-ui-runtime.mjs.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");

const recuperado = lf(process.env.CFG6D_FUENTE_RECUPERADA ? await readFile(process.env.CFG6D_FUENTE_RECUPERADA, "utf8") : await read("source-recovery/fuente-recuperado.js"));
const bundle = lf(process.env.CFG6D_FUENTE_BUNDLE ? await readFile(process.env.CFG6D_FUENTE_BUNDLE, "utf8") : await read("fuente.js"));

function entre(texto, ini, fin, nombre) {
  assert.equal(texto.split(ini).length, 2, `${nombre}: una única aparición de «${ini.slice(0, 50)}»`);
  const i = texto.indexOf(ini);
  const j = texto.indexOf(fin, i + ini.length);
  assert.ok(j > i, `${nombre}: no se encuentra el final «${fin.slice(0, 50)}»`);
  return texto.slice(i, j);
}
function funcion(texto, cabecera, nombre) {
  assert.equal(texto.split(cabecera).length, 2, `${nombre}: una única «${cabecera.slice(0, 60)}»`);
  const i = texto.indexOf(cabecera);
  const j = texto.indexOf("\n  }\n", i);
  assert.ok(j > i, `${nombre}: no termina ${cabecera}`);
  return texto.slice(i, j + 5);
}

// 1. Las piezas nuevas son idénticas en el bundle y en el fuente recuperado.
const bloques = (t, nombre) => ({
  logica: entre(t, "  // Cierre de caja (pieza 6d):", "  async function listarEstacionesA10() {", nombre),
  modulo: entre(t, "var CIERRE_TEXTO_BLOQUEO = {", "function CocinaA10({", nombre),
  cocina: entre(t, "function CocinaA10({", "\n}\n", nombre),
  enlaces: entre(t, "  // Las funciones del cierre de caja cuelgan de listarEstacionesA10", "  return { ", nombre),
  cierre4: entre(t, "  async function iniciarCierreSesionCajaA10() {", "  async function cerrarSesionCajaA10(", nombre),
  traducciones: entre(t, '    if (msg.includes("cierre_definitivo_diferencia_pendiente"))', '    if (msg.includes("contexto_no_autorizado") || msg.includes("no_autorizad"))', nombre)
});
const R = bloques(recuperado, "fuente recuperado");
const B = bloques(bundle, "bundle");
for (const k of Object.keys(R)) assert.equal(R[k], B[k], `el bloque «${k}» es idéntico en el bundle y en el fuente recuperado`);

// 2. El contexto del cierre: cualquier estado del cierre, día del servidor, sin depender del navegador.
const ctx = funcion(R.logica, "  async function contextoCierreA10(", "contextoCierreA10");
assert.match(ctx, /async function contextoCierreA10\(\{ conDia = true \} = \{\}\) \{/);
assert.match(ctx, /contextoTerminalA02\(supabase, empresaId, localActivoId, \{ permitirSinSesion: true \}\)/, "el terminal se resuelve sin exigir sesión ABIERTA");
assert.match(ctx, /\.from\("caja_sesion_terminales"\)[\s\S]*?\.eq\("terminal_id", terminal\.terminalId\)[\s\S]*?\.is\("hasta", null\)/, "la sesión es la vinculada al terminal y todavía no desvinculada");
assert.match(ctx, /vinculos\.length > 1 \? "terminal_sesion_ambigua" : "terminal_sin_sesion_abierta"/, "dos sesiones vinculadas o ninguna: se bloquea");
assert.match(ctx, /\.from\("caja_sesiones"\)\s*\.select\("id,estado,version"\)[\s\S]*?\.eq\("id", sessionId\)\s*\.maybeSingle\(\)/);
assert.doesNotMatch(ctx, /\.eq\("estado", "ABIERTA"\)/, "no exige que la sesión esté ABIERTA (después de «Iniciar cierre» ya no lo está)");
assert.match(ctx, /!\["ABIERTA", "EN_CIERRE", "CIERRE_PROVISIONAL"\]\.includes\(sesion\.estado\)\) throw new Error\("terminal_sin_sesion_abierta"\)/, "acepta exactamente los tres estados activos del cierre");
assert.match(ctx, /supabase\.rpc\("abc_obtener_dia_operativo_local", \{ p_empresa_id: empresaId, p_local_id: localActivoId \}\)/, "el día lo da el servidor");
assert.match(ctx, /if \(conDia\) \{/, "el día solo se pide cuando hace falta");
assert.match(ctx, /\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(String\(dia\?\.operating_day \|\| ""\)\)/, "se valida la forma de la fecha");
assert.match(ctx, /if \(!operatingDay\) throw new Error\("operating_day_servidor_ausente"\)/, "sin día del servidor no se inventa uno");
for (const prohibido of ["leerContextoCuentaA02", "todayISO", "localStorage", "contextoA10"])
  assert.ok(!ctx.includes(prohibido), `contextoCierreA10 no debe usar ${prohibido}`);
assert.match(ctx, /return \{ supabase, empresaId, localId: localActivoId, terminalId: terminal\.terminalId, sessionId, sessionEstado: sesion\.estado, operatingDay \};/);

// 3. Los pasos del cierre y el ensayo C12 usan ese contexto; el resto de A10 conserva el suyo.
for (const f of ["iniciarCierreSesionCajaA10() {", "confirmarCierreProvisionalA10({ efectivoContado = 0 } = {}) {", "ensayarCierreSesionCajaC12() {", "finalizarCierreSesionCajaA10() {", "reabrirCierreProvisionalA10({ motivo = \"\" } = {}) {"]) {
  const i = R.cierre4.indexOf("async function " + f);
  assert.ok(i >= 0, "falta " + f);
  assert.ok(R.cierre4.slice(i, i + 160).includes("const contexto = await contextoCierreA10();"), f + " usa el contexto del cierre");
}
assert.ok(!R.cierre4.includes("contextoA10("), "las operaciones del cierre ya no dependen de la última cuenta del navegador");
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  assert.equal(t.split("contextoA10(true)").length - 1, 1, nombre + ": solo queda un uso de contextoA10(true) (otra operación de A10 que no es el cierre)");
  assert.equal(t.split("async function contextoA10(requiereDia = false) {").length - 1, 1, nombre + ": contextoA10 se conserva");
  assert.match(t, /operating_day_context_required/, nombre + ": el aviso histórico se conserva para el resto de A10");
}

// 4. Llamadas al servidor con los nombres y parámetros exactos de las migraciones.
const migs = ["supabase/migrations/20261002210000_abc_config_pieza2_diferencia_caja.sql", "supabase/migrations/20261002250000_abc_config_pieza6d_dia_operativo.sql", "supabase/migrations/20261005160403_abc_f5_c03_arqueo_sesion.sql", "supabase/migrations/20261001220000_abc_f5_c12_close_rehearsal.sql"];
const firmas = new Map();
for (const m of migs) {
  const t = lf(await read(m));
  for (const x of t.matchAll(/create function public\.([a-z_0-9]+)\(([\s\S]*?)\)\s*returns/g)) {
    firmas.set(x[1], x[2].split(",").map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/)[0]));
  }
}
for (const n of ["abc_registrar_diferencia_caja", "abc_decidir_diferencia_caja", "abc_obtener_diferencia_caja", "abc_obtener_dia_operativo_local", "abc_previsualizar_arqueo_caja", "abc_ensayar_cierre_sesion_caja"]) assert.ok(firmas.has(n), "no está en las migraciones: " + n);
const clavesDe = (texto, rpc) => {
  const m = texto.match(new RegExp(`"${rpc}", \\{([^}]*)\\}`));
  assert.ok(m, "no se encuentra la llamada a " + rpc);
  return [...m[1].matchAll(/\b(p_[a-z_0-9]+):/g)].map((k) => k[1]);
};
for (const rpc of ["abc_registrar_diferencia_caja", "abc_decidir_diferencia_caja", "abc_obtener_diferencia_caja", "abc_obtener_dia_operativo_local", "abc_previsualizar_arqueo_caja"])
  assert.deepEqual(clavesDe(R.logica, rpc), firmas.get(rpc), `${rpc}: la llamada envía exactamente los parámetros de la función del servidor, en su orden`);
assert.deepEqual(clavesDe(R.cierre4, "abc_ensayar_cierre_sesion_caja"), firmas.get("abc_ensayar_cierre_sesion_caja"), "C12 envía exactamente los parámetros de la función del servidor, en su orden");
assert.equal((R.logica.match(/\.rpc\(/g) || []).length, 3, "tres lecturas directas (día, vista previa y diferencia); el resto va por rpcA02ConRecuperacion");
for (const rpc of ["abc_registrar_diferencia_caja", "abc_decidir_diferencia_caja"])
  assert.match(R.logica, new RegExp(`rpcA02ConRecuperacion\\(contexto\\.supabase, "${rpc}", \\{`), `${rpc} se envía con idempotencia y recuperación`);
assert.match(R.cierre4, /rpcA02ConRecuperacion\(contexto\.supabase, "abc_ensayar_cierre_sesion_caja", \{/, "C12 se envía con idempotencia y recuperación");
assert.match(R.logica, /const operationId = `f6\.ui\.cash\.diff\.register\.\$\{uuidA02\(\)\}`;/);
assert.match(R.logica, /const operationId = `f6\.ui\.cash\.diff\.decide\.\$\{uuidA02\(\)\}`;/);
assert.match(R.cierre4, /const operationId = `f7\.ui\.cash\.close\.rehearsal\.\$\{uuidA02\(\)\}`;/);
assert.match(R.logica, /if \(decisionLimpia !== "APROBAR" && decisionLimpia !== "RECHAZAR"\) throw new Error\("diferencia_caja_decision_invalida"\);/, "solo APROBAR o RECHAZAR");
assert.equal((R.logica.match(/diferencia_caja_motivo_requerido/g) || []).length, 2, "el motivo es obligatorio en el registro y en la decisión");
assert.match(R.logica, /p_decision: decisionLimpia,/);
assert.match(R.logica, /const decisionLimpia = String\(decision \|\| ""\)\.trim\(\)\.toUpperCase\(\);/, "la decisión se normaliza a mayúsculas");
assert.match(R.logica, /const motivoLimpio = String\(motivo \|\| ""\)\.trim\(\);/);
// consultar: la diferencia solo se pide con el cierre provisional
assert.match(R.logica, /if \(contexto\.sessionEstado !== "CIERRE_PROVISIONAL"\) return base;/);
assert.match(R.logica, /if \(error\) return \{ \.\.\.base, diferenciaError: errorRpcA02\(error\) \};/, "si no se puede leer la diferencia, se sigue y decide el servidor");
// sin escribir en tablas
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  assert.doesNotMatch(t, /from\("caja_[a-z_]+"\)\s*\.(insert|update|upsert|delete)/, nombre + ": ninguna escritura directa en tablas de caja");
  assert.doesNotMatch(R.logica + R.cocina, /caja_cierre_diferencias/, nombre + ": la pantalla no toca la tabla de diferencias");
  assert.doesNotMatch(t, /rpc\("abc_cerrar_sesion_caja"/, nombre + ": no se vuelve al cierre directo antiguo");
}

// 4b. Detalles que la prueba de ejecución ya cubre y aquí se fijan también
assert.match(ctx, /if \(!Array\.isArray\(vinculos\) \|\| vinculos\.length !== 1\) throw/, "exactamente una sesión vinculada");
assert.match(R.logica, /return \{ \.\.\.base, \.\.\.\(data \|\| \{\}\), ok: true, sessionEstado: contexto\.sessionEstado \};/, "la consulta devuelve la diferencia del servidor");
assert.equal((R.logica.match(/p_motivo: motivoLimpio/g) || []).length, 2, "el motivo se envía recortado en el registro y en la decisión");
assert.equal((R.logica.match(/contextoCierreA10\(\{ conDia: false \}\)/g) || []).length, 3, "consultar, registrar y decidir no piden el día operativo");
assert.match(R.modulo, /umbral: r2\?\.umbral \?\? 0,/);
assert.match(R.modulo, /requiereAprobacion: r2\?\.requiere_aprobacion === true,/);
assert.match(R.modulo, /registro: r2\?\.registro \|\| null,/);
assert.match(R.modulo, /bloqueos: Array\.isArray\(r2\?\.bloqueos\) \? r2\.bloqueos : \[\]/);

// 5. Las funciones cuelgan de listarEstacionesA10 al crear la lógica y al llamarla.
for (const n of ["abrirSesionCajaA10", "cerrarSesionCajaA10", "iniciarCierreSesionCajaA10", "confirmarCierreProvisionalA10", "ensayarCierreSesionCajaC12", "finalizarCierreSesionCajaA10", "reabrirCierreProvisionalA10", "consultarCierreCajaA10", "registrarDiferenciaCajaA10", "decidirDiferenciaCajaA10"])
  assert.ok(R.enlaces.includes(`  listarEstacionesA10.${n} = ${n};\n`), "al crear la lógica se enlaza " + n);
for (const n of ["ensayarCierreSesionCajaC12", "consultarCierreCajaA10", "registrarDiferenciaCajaA10", "decidirDiferenciaCajaA10"])
  assert.equal(recuperado.split(`    listarEstacionesA10.${n} = ${n};\n`).length - 1, 1, "y al llamar a listarEstacionesA10 se enlaza " + n);

// 6. Traducciones de los códigos nuevos (nunca códigos crudos para la persona).
const traduccionesEsperadas = {
  cierre_definitivo_diferencia_pendiente: "la diferencia de caja está sin tratar", diferencia_caja_motivo_requerido: "Escribe el motivo de la diferencia de caja",
  diferencia_caja_motivo_invalido: "hasta 500 caracteres", diferencia_caja_inexistente: "No hay ninguna diferencia de caja que registrar", diferencia_caja_ya_decidida: "ya decidió esta diferencia",
  diferencia_caja_sin_registro: "registrar el motivo de la diferencia", diferencia_caja_cambiada: "La diferencia cambió", diferencia_caja_no_requiere_aprobacion: "no supera el umbral",
  diferencia_caja_decision_invalida: "La decisión no es válida", abc_diferencia_caja_no_autorizada: "Solo el Propietario puede aprobar o rechazar", sesion_no_provisional: "ya no está en estado provisional",
  cierre_provisional_no_encontrado: "ya no está en estado provisional", dia_operativo_local_no_disponible: "El local no está disponible"
};
for (const [codigo, frase] of Object.entries(traduccionesEsperadas)) {
  const linea = R.traducciones.split("\n").find((l) => l.includes(`"${codigo}"`));
  assert.ok(linea, "falta traducir " + codigo);
  assert.ok(linea.includes(frase), `${codigo} se traduce como «${frase}»`);
}
assert.ok(R.traducciones.indexOf("abc_diferencia_caja_no_autorizada") < R.traducciones.length, "(orden) las traducciones van antes del genérico «no_autorizad»");

// 7. La pantalla de cierre.
const c = R.cocina;
assert.match(c, /const ensayarCierreSesionCajaC12 = typeof listarEstacionesA10\?\.ensayarCierreSesionCajaC12 === "function" \? listarEstacionesA10\.ensayarCierreSesionCajaC12 : null;/);
assert.match(c, /const consultarCierreCajaA10 = typeof listarEstacionesA10\?\.consultarCierreCajaA10 === "function" \? listarEstacionesA10\.consultarCierreCajaA10 : null;/);
assert.match(c, /const registrarDiferenciaCajaA10 = typeof listarEstacionesA10\?\.registrarDiferenciaCajaA10 === "function" \? listarEstacionesA10\.registrarDiferenciaCajaA10 : null;/);
assert.match(c, /const decidirDiferenciaCajaA10 = typeof listarEstacionesA10\?\.decidirDiferenciaCajaA10 === "function" \? listarEstacionesA10\.decidirDiferenciaCajaA10 : null;/);
assert.match(c, /const bloqueosDiferencia = Array\.isArray\(cierreInfo\?\.bloqueos\) \? cierreInfo\.bloqueos : \[\];/);
assert.match(c, /const \[ensayoCierre, setEnsayoCierre\] = \(0, import_react4\.useState\)\(null\);/);
// recuperar el estado del servidor al entrar y al actualizar
assert.match(c, /async function sincronizarCierre\(\) \{\s+if \(typeof consultarCierreCajaA10 !== "function"\) return null;/);
assert.match(c, /if \(estado === "EN_CIERRE" \|\| estado === "CIERRE_PROVISIONAL"\) \{\s+setEstadoCierre\(estado\);\s+setArqueoPrevio\(estado === "EN_CIERRE" && !r2\.arqueoError \? r2\.arqueoPrevio \|\| null : null\);\s+if \(r2\.arqueoError\) setError\("No se pudo calcular el arqueo en el servidor: " \+ r2\.arqueoError\);\s+if \(estado !== "CIERRE_PROVISIONAL"\) \{\s+setCierreInfo\(null\);\s+setEnsayoCierre\(null\);\s+\}\s+else if \(!r2\.diferenciaError\) setCierreInfo\(infoCierreA10\(r2\)\);/, "se recuperan el arqueo y el estado del servidor y, si falla la lectura de la diferencia, se conserva la que ya se sabía");
assert.match(c, /async function refrescarCierreInfo\(\) \{\s+setEnsayoCierre\(null\);\s+return sincronizarCierre\(\);\s+\}/, "tras cada acción se invalida el ensayo y se vuelve a leer TODO el estado del cierre");
assert.match(c, /\} else if \(estado === "ABIERTA"\) \{\s+setEstadoCierre\("ABIERTA"\);\s+setArqueoPrevio\(null\);\s+setCierreInfo\(null\);\s+setEnsayoCierre\(null\);/);
const refresco = funcion(c, "  async function refrescarEstaciones() {", "refrescarEstaciones");
assert.ok(refresco.indexOf("await sincronizarCierre()") < refresco.indexOf("await listarEstacionesA10()"), "primero se recupera el estado del cierre y después se listan las estaciones");
assert.match(refresco, /if \(estadoServidor === "EN_CIERRE" \|\| estadoServidor === "CIERRE_PROVISIONAL"\) \{\s+setCargando\(false\);\s+setRequiereApertura\(false\);\s+setEstaciones\(\[\]\);\s+setRutas\(\[\]\);\s+return;\s+\}/, "con el cierre en marcha no se pide abrir sesión ni se listan estaciones");
// acciones
const registrar = funcion(c, "  async function registrarDiferencia() {", "registrarDiferencia");
assert.match(registrar, /if \(!motivoDiferencia\.trim\(\)\) \{\s+setError\("Escribe el motivo de la diferencia de caja\."\);\s+return;\s+\}/, "sin motivo no se envía");
assert.match(registrar, /await registrarDiferenciaCajaA10\(\{ motivo: motivoDiferencia\.trim\(\) \}\);/);
assert.match(registrar, /await refrescarCierreInfo\(\);\s+return;\s+\}\s+setMotivoDiferencia\(""\);/, "si falla se vuelve a leer el servidor y no se borra el motivo escrito");
const decidir = funcion(c, "  async function decidirDiferencia(decision) {", "decidirDiferencia");
assert.match(decidir, /if \(!motivoDecision\.trim\(\)\) \{\s+setError\("Escribe el motivo de tu decisión\."\);\s+return;\s+\}/, "sin motivo no se decide");
assert.match(decidir, /await decidirDiferenciaCajaA10\(\{ decision, motivo: motivoDecision\.trim\(\) \}\);/);
assert.match(decidir, /decision === "APROBAR" \? "Diferencia aprobada\. Ya se puede finalizar el cierre\." : "Diferencia rechazada\. Reabre el cierre y vuelve a contar\."\);\s+await refrescarCierreInfo\(\);\s+\}\s*$/, "tras decidir se vuelve a leer el servidor");
assert.match(decidir, /setError\(resultado\?\.error \|\| "No se pudo registrar tu decisión\."\);\s+await refrescarCierreInfo\(\);\s+return;/, "si falla, también");
// el provisional lee la diferencia y la finalización la vuelve a leer si el servidor la rechaza
assert.match(c, /\$\{Number\(resultado\.difference \|\| 0\) !== 0 \? "Hay una diferencia: registra su motivo antes de finalizar\." : "Puedes finalizarlo o reabrirlo con motivo\."\}`\);\s+await refrescarCierreInfo\(\);/);
assert.match(c, /setError\(resultado\?\.error \|\| "No se pudo finalizar el cierre\."\);\s+await refrescarCierreInfo\(\);/);
// al cerrar o reabrir se limpia lo de la diferencia
for (const marca of ['setMensaje("Sesión cerrada definitivamente por el servidor.', 'setMensaje("Cierre provisional reabierto.'])
  assert.match(c, new RegExp(`setCierreInfo\\(null\\);\\s+setEnsayoCierre\\(null\\);\\s+setMotivoDiferencia\\(""\\);\\s+setMotivoDecision\\(""\\);\\s+${marca.replace(/[().]/g, "\\$&")}`), "se limpian la diferencia y el ensayo antes de: " + marca);
// la caja de diferencia
const dif = funcion(c, "  function renderDiferencia() {", "renderDiferencia");
assert.match(dif, /Number\(info\.difference\) === 0\) return null;/, "sin diferencia no se pinta nada");
assert.match(dif, /const esPropietarioCierre = rolPerfil === "Propietario";/, "decide solo el Propietario");
assert.match(dif, /const pideMotivo = !registro \|\| bloqueosDiferencia\.includes\("DIFERENCIA_SIN_MOTIVO"\) \|\| bloqueosDiferencia\.includes\("DIFERENCIA_CAMBIADA"\);/);
assert.match(dif, /"data-diferencia-caja": "1"/);
for (const txt of ["Diferencia de caja: €", "Toda diferencia exige un motivo y queda en la auditoría. ", "Motivo de la diferencia (obligatorio)", "Registrar motivo", "Motivo registrado: «", "Aprobada por el Propietario: «", "Rechazada por el Propietario: «",
  "Motivo guardado. Ya se puede finalizar el cierre.", "Motivo de tu decisión (obligatorio)", "Aprobar diferencia", "Rechazar diferencia", "Pendiente de aprobación del Propietario. El cierre no se puede finalizar hasta entonces."])
  assert.ok(dif.includes(txt), "la caja de diferencia dice: " + txt);
assert.match(dif, /registro\.estado === "REGISTRADA" && info\.requiereAprobacion \? \(esPropietarioCierre \? h3\("div", null,/, "los botones de decidir solo si hay que aprobar y es Propietario");
assert.match(dif, /onClick: \(\) => decidirDiferencia\("APROBAR"\), disabled: !!procesando \|\| !motivoDecision\.trim\(\)/);
assert.match(dif, /onClick: \(\) => decidirDiferencia\("RECHAZAR"\), disabled: !!procesando \|\| !motivoDecision\.trim\(\)/);
assert.match(dif, /onClick: registrarDiferencia, disabled: !!procesando \|\| !motivoDiferencia\.trim\(\)/);
// el bloque provisional pinta la diferencia y el ensayo C12; «Finalizar» conserva el bloqueo de diferencia.
assert.match(c, /reábrelo para corregir la sesión\."\),\s+renderDiferencia\(\),\s+ensayarCierreSesionCajaC12 \? h3\("div", \{ className: "mb-3" \},[\s\S]*?renderEnsayoC12\(\)[\s\S]*?bloqueosCierre\.length > 0/, "la diferencia y C12 van dentro del cierre provisional, antes de los bloqueos");
assert.match(c, /onClick: finalizarCierre, disabled: !!procesando \|\| bloqueosDiferencia\.length > 0 \}/, "«Finalizar cierre» no se ofrece con bloqueos de diferencia");
assert.equal(c.split("renderDiferencia(),").length - 1, 1, "la caja de diferencia se pinta en un único sitio");
const ensayoUi = funcion(c, "  function renderEnsayoC12() {", "renderEnsayoC12");
for (const txt of ["data-c12-ensayo", "Ensayo C12: ", "Efectivo esperado €", "documentos conciliados ", "documentos de esta sesión pendientes de conciliación"])
  assert.ok(ensayoUi.includes(txt), "el informe C12 muestra: " + txt);
const ensayarUi = funcion(c, "  async function ensayarCierre() {", "ensayarCierre");
assert.match(ensayarUi, /await ensayarCierreSesionCajaC12\(\);/);
assert.match(ensayarUi, /setEnsayoCierre\(resultado\);/);
assert.match(c, /onClick: ensayarCierre, disabled: !!procesando/);
// textos de los bloqueos
for (const k of ["DIFERENCIA_SIN_MOTIVO", "DIFERENCIA_PENDIENTE_APROBACION", "DIFERENCIA_RECHAZADA", "DIFERENCIA_CAMBIADA"]) assert.ok(R.modulo.includes(`${k}: "`), "texto para " + k);
// 6f sigue en su sitio
assert.match(c, /puedeReabrirCierre === false \? null : h3\(Btn, \{ small: true, variant: "ghost", onClick: reabrirProvisional/, "el permiso de reabrir (6f) no se toca");

// 8. El contrato vivo y la prueba de ejecución existen y cubren los casos exigidos.
const vivo = await read("tests/cfg/cfg6d-ui-runtime.mjs");
for (const marca of ["A1.1 iniciar el cierre funciona sin ninguna cuenta abierta", "A2.1 con la sesión ya EN_CIERRE el siguiente paso funciona", "A2.2b C12 ensaya sin cerrar", "A2.2c C12 envía sesión, terminal y día", "A3.1 una cuenta antigua guardada", "A4.3 en cierre provisional trae la diferencia",
  "A5.1 finalizar con la diferencia sin tratar se rechaza", "A5.4 registrar el motivo", "A5.8 un Cajero/a no puede aprobar", "A5.9 el Propietario aprueba", "A5.12 ahora sí se finaliza", "A6.1 rechazar deja el bloqueo",
  "A7.1 una diferencia dentro del umbral", "A8.5 si el servidor no da el día", "B1.2 iniciar el cierre ya no da el aviso", "B1.3b se ofrece el ensayo C12", "B1.3c el ensayo apto se explica", "B1b.1 C12 muestra PENDIENTE", "B2.1 aparece la diferencia", "B2.6 el Cajero/a ve", "B2.8 recargar la pantalla en cierre provisional",
  "B2.9 el Propietario ve", "B2.11 se finaliza el cierre con diferencia", "B3.1 rechazada", "B3.3 reabrir devuelve la caja a ABIERTA", "B4.1 con el cierre ya iniciado", "B5.2 un error del servidor", "B6.2 al finalizar, el servidor la rechaza",
  "B7.1 el Cajero/a sin permiso de reabrir", "B8.2 tras el motivo se puede finalizar sin aprobación", "B9.1 sin la lectura C03 el provisional queda bloqueado", "B10.1 si la diferencia cambió desde el motivo", "B11.1 tras recargar, la diferencia aprobada", "B12.2 «Actualizar» recupera el cierre en marcha", "B12b.1 tras reabrir, el motivo escrito", "B13.1 si otro dispositivo ya la decidió", "B13b.1 decidir con datos viejos", "B13c.1 si el cierre ya no está en provisional", "B14.1 si falla la lectura de la diferencia"])
  assert.ok(vivo.includes(marca), "falta el caso de ejecución: " + marca);

console.log("cfg6d-ui-contract: OK");

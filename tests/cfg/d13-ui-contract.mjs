import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático de pantalla de D13 (devoluciones: nada sale sin aprobar), pantalla «Reembolso económico» (pestaña Devoluciones):
//  - el bloque nuevo es idéntico en `fuente.js` y en `source-recovery/fuente-recuperado.js`;
//  - llama a las funciones del servidor con los nombres y parámetros EXACTOS de las migraciones (incluida `abc_aprobar_reembolso`);
//  - solo lee (sin escrituras directas en tablas) y no toca `abc_resolver_reembolso` (es solo del sistema);
//  - los permisos se leen del servidor y, si no se pueden leer, la pantalla se comporta como antes (decide el servidor);
//  - una solicitud sin aprobar sale «Pendiente de aprobación»; «Aprobar» no se ofrece sobre lo que uno mismo solicitó; el efectivo no se
//    confirma sin aprobar; los mensajes y errores nuevos están en español;
//  - el rol llega desde la aplicación hasta la pantalla.
// CFG_D13_FUENTE_RECUPERADA y CFG_D13_FUENTE_BUNDLE permiten probar variantes rotas en las comprobaciones de mutantes.
// La conducta la prueba tests/cfg/d13-ui-runtime.mjs.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");
const recuperado = lf(process.env.CFG_D13_FUENTE_RECUPERADA ? await readFile(process.env.CFG_D13_FUENTE_RECUPERADA, "utf8") : await read("source-recovery/fuente-recuperado.js"));
const bundle = lf(process.env.CFG_D13_FUENTE_BUNDLE ? await readFile(process.env.CFG_D13_FUENTE_BUNDLE, "utf8") : await read("fuente.js"));

function entre(texto, ini, fin, nombre) {
  assert.equal(texto.split(ini).length, 2, `${nombre}: una única aparición de «${ini.slice(0, 60)}»`);
  const i = texto.indexOf(ini);
  const j = texto.indexOf(fin, i + ini.length);
  assert.ok(j > i, `${nombre}: no se encuentra el final «${fin.slice(0, 50)}»`);
  return texto.slice(i, j);
}
// 1. El bloque de la pantalla es idéntico en los dos archivos.
const bloque = (t, nombre) => ({
  mensajes: entre(t, "function mensajeErrorReembolsoB08(", "async function contextoTerminalReembolsoB08(", nombre),
  componente: entre(t, "function ReembolsosEconomicosB08(", "function Devoluciones(", nombre),
  devoluciones: entre(t, "function Devoluciones(", "  const [vista, setVista]", nombre)
});
const R = bloque(recuperado, "fuente recuperado");
const B = bloque(bundle, "bundle");
for (const k of Object.keys(R)) assert.equal(R[k], B[k], `el bloque «${k}» es idéntico en el bundle y en el fuente recuperado`);
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  const cuenta = (s) => t.split(s).length - 1;
  assert.equal(cuenta('vista === "reembolso" && h3(ReembolsosEconomicosB08, { empresaId, localId, rolPerfil })'), 1, nombre + ": la pestaña pasa el rol a la pantalla");
  assert.equal(cuenta('empresaId: empresaDelLocalActivo?.id || "", localId: localActivoId || "", rolPerfil: miPerfil?.rol || "" }'), 1, nombre + ": la aplicación pasa el rol del perfil a Devoluciones (al final de las propiedades)");
  assert.equal(cuenta('["ABC_REEMBOLSO_SOLICITAR", "Solicitar devoluciones (el Cajero/a necesita aprobación)"],'), 1, nombre + ": etiqueta de la matriz de permisos (solicitar)");
  assert.equal(cuenta('["ABC_REEMBOLSO_CONFIRMAR", "Aprobar y confirmar devoluciones"]'), 1, nombre + ": etiqueta de la matriz de permisos (aprobar y confirmar)");
}
assert.match(R.devoluciones, /saltoProveedor = 0, empresaId = "", localId = "", rolPerfil = "" \}\) \{/, "Devoluciones recibe el rol al final de sus propiedades");
assert.match(R.componente, /^function ReembolsosEconomicosB08\(\{ empresaId = "", localId = "", rolPerfil = "" \}\) \{/, "la pantalla recibe el rol");

// 2. Llamadas al servidor con los nombres y parámetros exactos de las migraciones.
const sigs = new Map();
for (const m of ["20260924003000_abc_f2_m04c_outbox_persistente", "20260923235900_abc_f2_m03c_reembolsos_transaccionales", "20261003100000_abc_config_d13_reembolsos_aprobacion"]) {
  const t = lf(await read("supabase/migrations/" + m + ".sql"));
  for (const x of t.matchAll(/create (?:or replace )?function public\.(abc_(?:solicitar|aprobar|cancelar|confirmar)_reembolso(?:_efectivo)?)\(([\s\S]*?)\)\s*returns/g))
    sigs.set(x[1], x[2].split(",").map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/)[0]));
}
for (const n of ["abc_solicitar_reembolso", "abc_aprobar_reembolso", "abc_cancelar_reembolso", "abc_confirmar_reembolso_efectivo"]) assert.ok(sigs.has(n), "no está en las migraciones: " + n);
assert.deepEqual(sigs.get("abc_aprobar_reembolso"), ["p_operation_id", "p_empresa_id", "p_local_id", "p_reembolso_id", "p_terminal_id", "p_operating_day"], "firma de la función nueva");
const clavesDe = (texto, nombre) => {
  const m = texto.match(new RegExp(`supabase\\.rpc\\("${nombre}", \\{([\\s\\S]*?)\\n\\s+\\}\\)`));
  assert.ok(m, "no se encuentra la llamada a " + nombre);
  return [...m[1].matchAll(/\b(p_[a-z_0-9]+):/g)].map((k) => k[1]);
};
for (const n of ["abc_solicitar_reembolso", "abc_aprobar_reembolso", "abc_cancelar_reembolso", "abc_confirmar_reembolso_efectivo"])
  assert.deepEqual(clavesDe(R.componente, n), sigs.get(n), `${n}: parámetros exactos y en su orden`);
assert.equal((R.componente.match(/supabase\.rpc\(/g) || []).length, 4, "cuatro llamadas a funciones del servidor, ni una más");
assert.match(R.componente, /p_operation_id: `b08\.ui\.approve\.\$\{row\.id\}`,\s+p_empresa_id: empresaId,\s+p_local_id: localId,\s+p_reembolso_id: row\.id,\s+p_terminal_id: terminal\.terminalId,\s+p_operating_day: operatingDay/, "la aprobación: operación idempotente por reembolso, terminal y día");
assert.match(R.componente, /await configRpc\("abc_obtener_capacidades_rol", \{ p_empresa_id: empresaId, p_local_id: localId \}\)/, "los permisos se leen con la función de la pieza 5");
assert.doesNotMatch(R.componente, /abc_resolver_reembolso/, "el resultado del proveedor es solo del sistema");
assert.doesNotMatch(R.componente, /\.(insert|update|upsert|delete)\(/, "la pantalla solo lee: ninguna escritura directa en tablas");
assert.match(R.componente, /\.from\("reembolsos"\)\s+\.select\("id,pago_id,estado,payment_currency_code,importe_solicitado,provider_code,provider_reference,motivo,created_at,resolved_at,created_by,aprobado_por,aprobado_at"\)/, "se piden las columnas de aprobación");
assert.match(R.componente, /const sesionUsuario = await supabase\.auth\.getSession\(\);\s+setUsuarioId\(String\(sesionUsuario\?\.data\?\.session\?\.user\?\.id \|\| ""\)\);/, "se sabe quién es el usuario (solo lectura)");
// lo que ya comprobaba el contrato B08 sigue estando
assert.match(R.componente, /El simulador no envía dinero a un proveedor real/);
assert.match(R.componente, /p_operating_day: operatingDay/);
assert.match(R.componente, /p_motivo: String\(motivo\)\.trim\(\)/);

// 3. Permisos: leídos del servidor; si no se pueden leer, como antes.
assert.match(R.componente, /const \[permisos, setPermisos\] = import_react4\.default\.useState\(\{ solicitar: null, confirmar: null \}\);/, "al principio no se sabe nada (null = como antes)");
assert.match(R.componente, /setPermisos\(\{ solicitar: celdaDe\("ABC_REEMBOLSO_SOLICITAR"\), confirmar: celdaDe\("ABC_REEMBOLSO_CONFIRMAR"\) \}\);/, "los dos permisos de devoluciones");
assert.match(R.componente, /return celda \? celda\.efectivo === true : false;/, "una capacidad que no aparece es «no»");
assert.match(R.componente, /\} catch \(e2\) \{\s+if \(activo\) setPermisos\(\{ solicitar: null, confirmar: null \}\);/, "si la lectura falla, vuelve a «no se sabe»");
assert.match(R.componente, /if \(!empresaId \|\| !localId \|\| !rolPerfil\) return void 0;/, "sin rol, no se lee nada");
assert.match(R.componente, /\}, \[empresaId, localId, rolPerfil\]\);/, "se vuelve a leer al cambiar de local o de rol");
assert.match(R.componente, /permisos\.solicitar === false && h3\("div", \{ className: "text-\[11\.5px\] mb-2", style: \{ color: C2\.inkSoft \}, "data-aviso-reembolso": "sin-permiso" \}, "Tu usuario no tiene permiso para solicitar reembolsos\. El Propietario puede activarlo en Sistema → Configuración → Permisos\."\)/, "aviso sin permiso (solo si se sabe que no)");
assert.match(R.componente, /permisos\.solicitar === true && permisos\.confirmar === false && h3\("div", \{ className: "text-\[11\.5px\] mb-2", style: \{ color: C2\.inkSoft \}, "data-aviso-reembolso": "con-aprobacion" \}, "Lo que solicites quedará pendiente de aprobación: no sale dinero hasta que un Encargado o el Propietario lo apruebe\."\)/, "aviso de que quedará pendiente de aprobación");
assert.match(R.componente, /disabled: !!procesando \|\| !pagoSeleccionado \|\| permisos\.solicitar === false, onClick: solicitar/, "el botón de solicitar se desactiva solo si se sabe que no hay permiso");

// 4. Filas: pendiente de aprobación, aprobar, rechazar y efectivo.
assert.match(R.componente, /const pendienteAprobacion = String\(row\.estado\) === "PENDIENTE" && !row\.aprobado_at;/, "pendiente de aprobación = PENDIENTE y sin aprobar");
assert.match(R.componente, /const esMia = !!usuarioId && String\(row\.created_by \|\| ""\) === usuarioId;/, "lo que uno solicitó");
assert.match(R.componente, /pendienteAprobacion \? "Pendiente de aprobación" : etiquetaEstadoB08\(row\.estado\)/, "la etiqueta de la fila");
assert.match(R.componente, /permisos\.confirmar === false \? "Esperando a que la apruebe un Encargado o el Propietario\. Hasta entonces no sale dinero\." : esMia \? "Tiene que aprobarla otra persona\. Hasta entonces no sale dinero\." : "Revisa la solicitud y apruébala o recházala\. Hasta que se apruebe no sale dinero\."/, "los tres textos de la fila pendiente");
assert.match(R.componente, /esPendiente && permisos\.confirmar !== false && h3\("div", \{ className: "flex gap-2 flex-wrap mt-2" \},/, "sin permiso de aprobar no hay botones (si se sabe)");
assert.match(R.componente, /pendienteAprobacion && !esMia && h3\(Btn, \{ small: true, disabled: !!procesando, onClick: \(\) => aprobar\(row\) \}, procesando === `aprobar:\$\{row\.id\}` \? "Aprobando…" : "Aprobar"\),/, "«Aprobar» solo sobre una solicitud pendiente de aprobación y que no es mía");
assert.match(R.componente, /!pendienteAprobacion && esEfectivo && h3\(Btn, \{ small: true, disabled: !!procesando, onClick: \(\) => confirmarEfectivo\(row\) \}/, "el efectivo no se confirma hasta aprobar");
assert.match(R.componente, /pendienteAprobacion \? "Rechazar solicitud" : "Cancelar solicitud"/, "rechazar o cancelar");
assert.match(R.componente, /async function aprobar\(row\) \{\s+if \(procesando\) return;\s+setProcesando\(`aprobar:\$\{row\.id\}`\);/, "aprobar no se vuelve a lanzar mientras otra operación sigue en curso");
assert.match(R.componente, /String\(row\.estado\) === "PENDIENTE" && row\.aprobado_at && h3\("div", \{ className: "text-\[11px\] mt-1", style: \{ color: C2\.inkSoft \} \}, `Aprobada el \$\{String\(row\.aprobado_at\)\.slice\(0, 16\)\.replace\("T", " "\)\}`\)/, "se ve cuándo se aprobó");
assert.match(R.componente, /setMensaje\(row\.aprobado_at \? "Solicitud cancelada y saldo liberado\." : "Solicitud rechazada y saldo liberado\."\);/, "mensaje de cancelar o de rechazar");
assert.match(R.componente, /setMensaje\(data\?\.requiere_aprobacion === true \? "Solicitud creada y pendiente de aprobación: no sale dinero hasta que un Encargado o el Propietario la apruebe\." : `Solicitud creada como \$\{data\?\.estado \|\| "PENDIENTE"\}\. El simulador no envía dinero a un proveedor real\.`\);/, "mensaje al solicitar");
assert.match(R.componente, /setMensaje\(String\(pago\?\.medio \|\| ""\) === "EFECTIVO" \? "Solicitud aprobada\. Ahora se puede confirmar el efectivo\." : "Solicitud aprobada\. El simulador no envía dinero a un proveedor real\."\);\s+await cargar\(\);/, "mensaje al aprobar y recarga");

// 5. Errores en español.
for (const [codigo, texto] of [
  ["abc_aprobar_reembolso_no_autorizado", "Tu usuario no tiene permiso para aprobar reembolsos."],
  ["reembolso_pendiente_aprobacion", "Este reembolso todavía no está aprobado: un Encargado o el Propietario tiene que aprobarlo antes."],
  ["reembolso_aprobador_distinto_solicitante", "No puedes aprobar una solicitud que hiciste tú: tiene que aprobarla otra persona."],
  ["reembolso_ya_aprobado", "Este reembolso ya estaba aprobado. Actualiza la pantalla."],
  ["reembolso_no_aprobable", "Este reembolso ya no se puede aprobar (está resuelto o cancelado). Actualiza la pantalla."]
]) assert.ok(R.mensajes.includes(`["${codigo}", "${texto}"]`), "traducción de " + codigo);
// los códigos del servidor que traducen son los que lanza la migración
const mig = lf(await read("supabase/migrations/20261003100000_abc_config_d13_reembolsos_aprobacion.sql"));
for (const c of ["abc_aprobar_reembolso_no_autorizado", "reembolso_pendiente_aprobacion", "reembolso_aprobador_distinto_solicitante", "reembolso_ya_aprobado", "reembolso_no_aprobable"])
  assert.ok(mig.includes(`raise exception '${c}'`), "la migración lanza " + c);
// el orden de la lista no debe esconder un código detrás de otro que lo contenga
const codigos = [...R.mensajes.matchAll(/\["([a-z_0-9]+)", "/g)].map((m) => m[1]);
codigos.forEach((c, i) => codigos.forEach((d, j) => { if (i < j && d.includes(c) && c !== d) assert.fail(`«${c}» esconde a «${d}» en la lista de traducciones`); }));

// 6. El contrato de ejecución existe y cubre los casos exigidos.
const vivo = await read("tests/cfg/d13-ui-runtime.mjs");
for (const marca of ["A2 aviso «lo que solicites quedará pendiente de aprobación»", "A5 la solicitud envía los parámetros exactos de siempre", "A6 el mensaje dice que queda pendiente de aprobación", "A7 la fila sale «Pendiente de aprobación»",
  "A9 sin botones de Aprobar, Rechazar, Cancelar ni Confirmar efectivo", "A11 la pantalla pide las columnas de aprobación", "B1 aviso «sin permiso»", "B3 aunque elija un pago", "C1 ve la solicitud del cajero", "C4 «Aprobar» llama a abc_aprobar_reembolso",
  "C6 la fila ya no está «Pendiente de aprobación»", "C8 un efectivo pendiente de aprobación NO ofrece «Confirmar efectivo»", "C10 y aparece «Confirmar efectivo»", "C12 «Rechazar solicitud» usa abc_cancelar_reembolso", "C13 el mensaje dice «rechazada»",
  "C14 una solicitud ya aprobada conserva «Cancelar solicitud»", "C16 su solicitud se aprueba en el acto", "C18 no se le ofrece «Aprobar» lo que solicitó él mismo", "C19 error «", "C20 si el servidor dice «pendiente de aprobación»",
  "D2 sin rol (versión anterior de la pantalla)", "D3 si no se pueden leer los permisos", "D3b y con los permisos desconocidos", "D6 al cambiar a Propietario", "D7 si el servidor no devuelve el permiso de aprobar", "D8 una solicitud ya confirmada no muestra", "D10 volver a lanzar la aprobación", "E1 desde «Devoluciones → Reembolso económico»"])
  assert.ok(vivo.includes(marca), "falta el caso de ejecución: " + marca);

console.log("d13-ui-contract: OK");

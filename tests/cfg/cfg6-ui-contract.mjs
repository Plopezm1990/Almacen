import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// Contrato estático de pantalla de la capa de configuración, PIEZA 6 (sub-piezas 6a, 6b, 6c y 6f):
//  - la pestaña «Configuración» (día y cajas, modalidades, equipos y permisos) y su cableado en el menú;
//  - los tres roles retirados fuera de la lista de alta de empleados;
//  - el botón «Reabrir cierre provisional» según el permiso real (D14).
// Lee `source-recovery/fuente-recuperado.js` y `fuente.js` (deben llevar exactamente lo mismo; la paridad completa de la
// lógica la exige además `python3 source-recovery/recuperar_candidato.py --check`). CFG6_FUENTE_RECUPERADA y
// CFG6_FUENTE_BUNDLE permiten probar variantes rotas en las comprobaciones de mutantes. La conducta (qué se envía, qué se
// muestra) la prueba tests/cfg/cfg6-ui-runtime.mjs.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");

const recuperado = lf(process.env.CFG6_FUENTE_RECUPERADA ? await readFile(process.env.CFG6_FUENTE_RECUPERADA, "utf8") : await read("source-recovery/fuente-recuperado.js"));
const bundle = lf(process.env.CFG6_FUENTE_BUNDLE ? await readFile(process.env.CFG6_FUENTE_BUNDLE, "utf8") : await read("fuente.js"));
const unescape = (t) => t.replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

const MARCA_INI = "// ==== CONFIGURACION_LOCAL (pieza 6) ====";
const MARCA_FIN = "// ==== FIN CONFIGURACION_LOCAL ====";
function region(texto, nombre) {
  assert.equal(texto.split(MARCA_INI).length, 2, `${nombre}: una única marca de inicio del componente`);
  assert.equal(texto.split(MARCA_FIN).length, 2, `${nombre}: una única marca de fin del componente`);
  const i = texto.indexOf(MARCA_INI);
  const j = texto.indexOf(MARCA_FIN);
  assert.ok(j > i, `${nombre}: la marca de fin va después de la de inicio`);
  return texto.slice(i, j + MARCA_FIN.length);
}
const compRec = region(recuperado, "fuente recuperado");
const compBun = region(bundle, "bundle");
assert.equal(compRec, compBun, "el componente es idéntico en el bundle y en el fuente recuperado");
const comp = compRec;

// 1. Cableado en los dos archivos (menú, grupo, montaje, roles, reabrir).
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  const cuenta = (s) => t.split(s).length - 1;
  assert.equal(cuenta('{ id: "configuracion", label: "Configuraci\\xF3n", icon: Cog },'), 1, nombre + ": entrada de menú «Configuración»");
  assert.equal(cuenta('pick(["auditoria", "respaldos", "notificaciones", "locales", "configuracion", "errores_sistema"])'), 1, nombre + ": en el grupo Sistema");
  assert.equal(cuenta('tab === "configuracion" && /* @__PURE__ */ import_react4.default.createElement(ConfiguracionLocal, { empresa: empresaDelLocalActivo, localId: localActivoId, localNombre: locales.find((l22) => l22.id === localActivoId)?.nombre || "", esPropietario: esPropietarioPM29 })'), 1, nombre + ": montaje de la pestaña, con el perfil Propietario");
  assert.equal(cuenta('tab === "configuracion"'), 1, nombre + ": una única pestaña «configuracion»");
  assert.equal(cuenta("function ConfiguracionLocal("), 1, nombre + ": una única pantalla");
  assert.ok(t.indexOf("function ConfiguracionLocal(") < t.indexOf("function PoliticasDescuentos("), nombre + ": el componente va junto a la pantalla modelo");
  for (const ayuda of ["ITEMS_EMPLEADO", "ROLES_EMPLEADO"]) assert.ok(cuenta(`var ${ayuda}`) >= 1);
  // Pestaña fuera del «modo empleado»: ningún rol de empleado la lista.
  const mapaRoles = t.slice(t.indexOf("var ROLES_EMPLEADO = {"), t.indexOf("var NOMBRES_ROLES = "));
  assert.ok(!mapaRoles.includes("configuracion"), nombre + ": ningún rol de empleado ve la pestaña");
  const inicioItems = t.indexOf("var ITEMS_EMPLEADO =");
  assert.ok(inicioItems >= 0 && !t.slice(inicioItems, t.indexOf("\n", inicioItems)).includes("configuracion"), nombre + ": la lista base de empleados tampoco la incluye");
  // Roles retirados.
  assert.equal(cuenta('var ROLES_RETIRADOS = ["B\\xE1sico", "Est\\xE1ndar", "Churrero/a"];'), 1, nombre + ": los tres roles retirados");
  assert.equal(cuenta("var NOMBRES_ROLES_ALTA = NOMBRES_ROLES.filter((r2) => !ROLES_RETIRADOS.includes(r2));"), 1, nombre + ": lista de alta sin los retirados");
  assert.equal(cuenta("NOMBRES_ROLES_ALTA.concat(ROLES_RETIRADOS.includes(form.rol) ? [form.rol] : []).map((r2) =>"), 1, nombre + ": el alta de empleados usa la lista sin retirados (y conserva el rol actual de quien ya lo tiene)");
  assert.equal(cuenta("NOMBRES_ROLES.map("), 0, nombre + ": ninguna lista de selección usa ya todos los roles");
  assert.ok(cuenta("var ROLES_EMPLEADO = {") === 1 && mapaRoles.includes('"Churrero/a"'), nombre + ": el mapa de pestañas de quien ya tiene un rol retirado no se toca");
  // Reabrir cierre (D14).
  assert.equal(cuenta('resolverMermaComandaA10, rolPerfil = "" }) {'), 1, nombre + ": la pantalla de cierre recibe el perfil");
  assert.equal(cuenta('resolverMermaComandaA10, rolPerfil: miPerfil?.rol || "" }), tab === "encargos"'), 1, nombre + ": y se le pasa el rol del perfil");
  assert.equal(cuenta('const [puedeReabrirCierre, setPuedeReabrirCierre] = (0, import_react4.useState)(null);'), 1);
  assert.equal(cuenta('puedeReabrirCierre === false ? null : h3('), 2, nombre + ": el motivo y el botón de reabrir solo se ocultan cuando se SABE que no hay permiso");
  assert.equal(cuenta('puedeReabrirCierre === false ? h3("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "Solo el Propietario (o quien él autorice en Configuración) puede reabrir un cierre provisional.") : null,'), 1);
  assert.equal(cuenta('includes("abc_caja_no_autorizado")) return { ok: false, error: "Solo el Propietario (o quien él autorice en Configuración) puede reabrir un cierre provisional."'), 1, nombre + ": el rechazo del servidor al reabrir se explica");
  assert.equal(cuenta('find((c3) => c3.capacidad === "ABC_CIERRE_REABRIR")'), 1, nombre + ": mira el permiso real de la capacidad nueva");
  assert.equal(cuenta('const celda = fila ? (fila.roles || []).find((r2) => r2.rol === rolPerfil) : null;\n        if (activo) setPuedeReabrirCierre(celda ? celda.efectivo === true : false);'), 1, nombre + ": un rol que no está en la matriz no puede reabrir");
  assert.ok(cuenta("} catch (e2) {\n        if (activo) setPuedeReabrirCierre(null);") === 1, nombre + ": si no se puede consultar, se muestra y decide el servidor");
}

// 2. El componente solo habla con el servidor por las funciones previstas, con sus nombres y parámetros exactos.
const migraciones = (await readdir(new URL("supabase/migrations/", root))).filter((n) => /^2026100219|^2026100221|^2026100222|^2026100223|^2026100224/.test(n) && n.includes("_abc_config_pieza")).sort();
assert.equal(migraciones.length, 5, "las migraciones de las piezas 1 a 5");
const textoMig = {};
for (const m of migraciones) textoMig[m] = lf(await read("supabase/migrations/" + m));
const firmas = new Map();
for (const m of migraciones) {
  for (const x of textoMig[m].matchAll(/create (?:or replace )?function public\.([a-z_0-9]+)\(([\s\S]*?)\)\s*returns/g)) {
    const params = x[2].split(",").map((p) => p.trim()).filter(Boolean).map((p) => ({ nombre: p.split(/\s+/)[0], defecto: /\sdefault\s/i.test(p) }));
    firmas.set(x[1], params);
  }
}
const llamadas = [...recuperado.matchAll(/configRpc\("([a-z_0-9]+)",\s*\{([^}]*)\}/g)].map((m) => ({ nombre: m[1], claves: [...m[2].matchAll(/\b(p_[a-z_0-9]+):/g)].map((k) => k[1]) }));
assert.ok(llamadas.length >= 11, "se localizan las llamadas al servidor");
const esperadas = ["abc_obtener_ajustes", "abc_configurar_ajuste", "abc_configurar_dia_operativo", "abc_obtener_modalidades_local", "abc_configurar_modalidad_local",
  "abc_listar_equipos_local", "abc_configurar_equipo_local", "abc_obtener_capacidades_rol", "abc_configurar_capacidad_rol", "abc_listar_roles_retirados"];
assert.deepEqual([...new Set(llamadas.map((l) => l.nombre))].sort(), esperadas.slice().sort(), "la pantalla usa exactamente estas 10 funciones (y nada más)");
for (const l of llamadas) {
  const firma = firmas.get(l.nombre);
  assert.ok(firma, "existe la función " + l.nombre + " en las migraciones");
  const nombres = firma.map((p) => p.nombre);
  for (const k of l.claves) assert.ok(nombres.includes(k), `${l.nombre}: el parámetro ${k} existe en la función`);
  for (const p of firma.filter((q) => !q.defecto)) assert.ok(l.claves.includes(p.nombre), `${l.nombre}: falta el parámetro obligatorio ${p.nombre}`);
  if (l.nombre.startsWith("abc_configurar_")) {
    assert.ok(l.claves.includes("p_motivo") && l.claves.includes("p_operation_id"), `${l.nombre}: todo cambio lleva motivo y operation_id`);
  }
}
assert.equal(llamadas.filter((l) => l.nombre.startsWith("abc_configurar_")).length, 6, "seis llamadas que cambian algo (cajas y umbral comparten función)");
assert.ok(!/\.supabase|supabase\.rpc\(/.test(comp.replace(/const \{ data, error \} = await supabase\.rpc\(nombre, parametros\);/, "")), "el componente solo llama al servidor a través de configRpc");
const tablas = [...comp.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]);
assert.deepEqual(tablas, ["terminales_tpv"], "la única lectura directa de una tabla es la de los terminales del local (como hace el resto de la aplicación)");
assert.ok(!/\.(insert|update|delete|upsert)\(/.test(comp), "el componente no escribe en ninguna tabla");
assert.ok(!/Borrar|Eliminar/.test(comp), "no hay botones de borrar: los equipos se desactivan");
assert.match(comp, /\.select\("id,nombre"\)\.eq\("empresa_id", empresaId\)\.eq\("local_id", localId\)\.eq\("activo", true\)/, "solo terminales activos de este local");
assert.match(comp, /function configOperacion\(clave\) \{\s+return "f6\.cfg\." \+ clave \+ "\." \+ configUuid\(\);\s+\}/, "operation_id con prefijo f6.cfg y un UUID nuevo");

// 3. Todos los errores que pueden dar esas funciones tienen su mensaje en español (y no sobran mensajes).
function cuerpoFuncion(nombre) {
  let ultimo = null;
  for (const m of migraciones) {
    const t = textoMig[m];
    const i = t.search(new RegExp(`create (?:or replace )?function public\\.${nombre}\\(`));
    if (i >= 0) ultimo = t.slice(i, t.indexOf("$$;", t.indexOf("as $$", i)));
  }
  assert.ok(ultimo, "cuerpo de " + nombre);
  return ultimo;
}
const erroresDelComp = comp.slice(comp.indexOf("var CONFIG_ERRORES = {"), comp.indexOf("function configUuid()"));
const clavesErrores = [...erroresDelComp.matchAll(/^\s{2}([a-z_0-9]+): "/gm)].map((m) => m[1]);
assert.equal(new Set(clavesErrores).size, clavesErrores.length, "sin mensajes repetidos");
const lanzados = new Set();
for (const f of esperadas) for (const m of cuerpoFuncion(f).matchAll(/raise exception '([a-z_0-9]+)'/g)) lanzados.add(m[1]);
for (const c of ["abc_no_autenticado", "contexto_no_autorizado", "operation_id_conflict", "command_type_requerido"]) lanzados.add(c);
for (const c of lanzados) assert.ok(clavesErrores.includes(c), "falta el mensaje del error " + c);
let todasLasMig = "";
for (const n of await readdir(new URL("supabase/migrations/", root))) if (n.endsWith(".sql")) todasLasMig += lf(await read("supabase/migrations/" + n)) + "\n";
for (const c of clavesErrores) assert.ok(todasLasMig.includes(`'${c}'`), "el mensaje " + c + " corresponde a un error real del servidor");
assert.match(erroresDelComp, /abc_config_no_autorizado: "Solo el Propietario puede cambiar esta configuración en este local\."/);
assert.match(comp, /function configMensajeError\(e2\) \{[\s\S]*?Object\.keys\(CONFIG_ERRORES\)\.find\(\(c3\) => texto\.includes\(c3\)\)[\s\S]*?return "No se pudo completar la operación\."/);

// 4. Las listas de la pantalla coinciden con las del servidor.
const catalogo = [...textoMig["20261002240000_abc_config_pieza5_permisos.sql"].matchAll(/\('(ABC_[A-Z_]+)','(?:GENERAL|COMANDA)',(?:true|false),(?:true|false),(?:true|false),(?:true|false),'(?:TODOS|ENCARGADO)'\)/g)].map((m) => m[1]);
assert.equal(catalogo.length, 31);
const enPantalla = [...comp.slice(comp.indexOf("var CONFIG_CAPACIDADES = ["), comp.indexOf("var CONFIG_ERRORES")).matchAll(/\["(ABC_[A-Z_]+)", "([^"]+)"\]/g)];
assert.deepEqual(enPantalla.map((m) => m[1]).sort(), catalogo.slice().sort(), "la pantalla rotula exactamente las 31 capacidades del catálogo");
assert.equal(new Set(enPantalla.map((m) => m[2])).size, 31, "cada permiso tiene una etiqueta distinta");
assert.match(comp, /var CONFIG_ROLES_MATRIZ = \["Encargado", "Cajero\/a", "Camarero\/a"\];/);
assert.match(textoMig["20261002240000_abc_config_pieza5_permisos.sql"], /select coalesce\(p_rol in \('Encargado','Cajero\/a','Camarero\/a'\),false\)/, "son los roles configurables del servidor");
assert.match(textoMig["20261002240000_abc_config_pieza5_permisos.sql"], /select coalesce\(p_rol in \('Churrero\/a','Básico','Estándar'\),false\)/, "y los retirados del servidor");
const modServidor = textoMig["20261002220000_abc_config_pieza3_modalidades.sql"].match(/constraint abc_local_modalidad_valor check \(modalidad in \(([^)]*)\)\)/)[1].match(/'([A-Z]+)'/g).map((x) => x.replace(/'/g, ""));
const modPantalla = [...comp.slice(comp.indexOf("var CONFIG_MODALIDADES"), comp.indexOf("var CONFIG_TIPOS_EQUIPO")).matchAll(/id: "([A-Z]+)"/g)].map((m) => m[1]);
assert.deepEqual(modPantalla, modServidor, "las cinco modalidades, en el orden del servidor");
const tiposServidor = textoMig["20261002230000_abc_config_pieza4_equipos.sql"].match(/constraint abc_local_equipo_tipo check \(tipo in \(([^)]*)\)\)/)[1].match(/'([A-Z_]+)'/g).map((x) => x.replace(/'/g, ""));
const tiposPantalla = [...comp.slice(comp.indexOf("var CONFIG_TIPOS_EQUIPO"), comp.indexOf("var CONFIG_ROLES_MATRIZ")).matchAll(/id: "([A-Z_]+)"/g)].map((m) => m[1]);
assert.deepEqual(tiposPantalla, tiposServidor, "los cinco tipos de equipo, en el orden del servidor");
assert.deepEqual(unescape(recuperado.match(/var ROLES_RETIRADOS = (\[[^\]]*\]);/)[1]).replace(/"/g, "").slice(1, -1).split(", "), ["Básico", "Estándar", "Churrero/a"]);

// 5. Quién ve la pantalla y qué hace antes de hablar con el servidor.
const ficha = comp.slice(comp.indexOf("function ConfiguracionLocal("));
assert.match(ficha, /if \(!esPropietario\) contenido = h\(Card, \{ className: "mb-4" \}, "Solo un usuario con rol Propietario puede ver y cambiar la configuración\."\);\s+else if \(!empresaId \|\| !localId\) contenido = h\(Card, \{ className: "mb-4" \}, "Selecciona un local concreto para configurarlo\."\);\s+else contenido = h\(/,
  "sin perfil Propietario o sin local concreto no se monta ninguna sección (y por tanto no se llama al servidor)");
assert.ok(ficha.indexOf("ConfigDia, {") > ficha.indexOf("else contenido = h("), "las secciones solo se montan en la rama con permiso");
assert.match(ficha, /const secciones = \[\["dia", "Día y cajas"\], \["modalidades", "Modalidades"\], \["equipos", "Equipos"\], \["permisos", "Permisos"\]\];/);
assert.equal((comp.match(/Escribe el motivo del cambio\./g) || []).length >= 4, true, "cada sección exige el motivo");
assert.match(comp, /B\u00E1sico, Est\u00E1ndar y Churrero\/a ya no se pueden asignar a nadie nuevo y no tienen ning\u00FAn permiso\./, "la pantalla explica la retirada de roles");
assert.doesNotMatch(comp, /bloqueada/, "Barra ya no está bloqueada: el TPV elige otra modalidad habilitada (pieza 6e)");
assert.doesNotMatch(comp, /siempre en Barra/);
assert.match(comp, /disabled: ocupado, onChange: \(e2\) => setElegidas\(\{ \.\.\.elegidas, \[m2\.modalidad\]: e2\.target\.checked \}\) \}\),/, "todas las casillas, también Barra, se pueden cambiar");
assert.match(comp, /El TPV abre la cuenta en Barra si est\u00E1 habilitada y, si no, en la primera habilitada; si hay varias, el cajero elige\./, "la pantalla explica qué hace el TPV");
assert.match(comp, /\.sort\(\(a3, b3\) => Number\(elegidas\[b3\.modalidad\]\) - Number\(elegidas\[a3\.modalidad\]\)\)/, "con varios cambios se habilita antes de deshabilitar");
assert.match(comp, /const bloqueado = !marcado && info\.puede_dar !== true;/, "lo que supera el techo no se puede dar");
assert.match(comp, /if \(nuevo && info\?\.puede_dar !== true\) return;/);
assert.match(comp, /<option|h\("option", \{ value: "EMPRESA", disabled: !puedeEmpresa \}/, "«Toda la empresa» solo si el servidor lo permite");
assert.match(comp, /const puedeEmpresa = datos\?\.puede_configurar_empresa === true;/);
assert.match(comp, /p_vigente_desde: null,/, "el corte del día se aplica desde mañana (lo decide el servidor)");
assert.match(comp, /p_cutoff_time: corte \+ ":00",/);
assert.match(comp, /p_permitido: c3\.permitido,/, "heredar se envía como nulo");
assert.match(comp, /await cargar\(true\);\s+\}\s+\};\s+const verRetirados/, "tras un fallo se recarga sin borrar el mensaje de error");

// 6. El contrato de ejecución existe y cubre los casos exigidos.
const runtime = await read("tests/cfg/cfg6-ui-runtime.mjs");
for (const marca of ["S1.1 sin perfil Propietario", "S2.1 sin local concreto", "S3.5 con motivo envía una sola operación", "S3.9 una hora de corte posterior", "S3.14 un rechazo del servidor se traduce",
  "S4.2 Barra se puede deshabilitar", "S4.6 con varios cambios se habilita antes de deshabilitar", "S5.5 el alta envía todos los parámetros", "S5.8 editar conserva el id", "S5.9 desactivar reenvía el equipo con activo=false",
  "S6.4 lo delicado no se puede dar", "S6.9 guarda cada cambio con ámbito LOCAL", "S6.12 se envía permitido nulo", "S6.13 con «Toda la empresa»", "S6.14 si falla el segundo", "S6.16 lista a las personas con roles retirados",
  "R1 los tres roles retirados no están en la lista de alta", "C1 el Propietario ve el motivo", "C4 el Cajero/a no ve el botón", "C6 si el Propietario autoriza al Encargado", "C7 si no se puede consultar el permiso", "C9 un rol que no está en la matriz"])
  assert.ok(runtime.includes(marca), "falta el caso de ejecución: " + marca);

console.log("cfg6-ui-contract: OK");

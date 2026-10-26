import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");

// T8, pieza 5 (Etapa 6): "edición de opciones con clave del propietario". Alcance elegido por
// Pedro (25/10/2026, chat), entre tres opciones: construir solo esta parte (no existe ninguna
// tecla de función real que gestionar por cargo todavía, Etapa 9 sin empezar).
//
// Diseño: no es la contraseña de "otra persona" (nunca se pide eso en la pantalla) — es la
// propia contraseña de quien está editando (Propietario o Encargado, el mismo permiso que ya
// exige abc_catalogo_puede_gestionar), reintroducida como confirmación extra antes de guardar
// cualquier cambio en la biblioteca de opciones (piezas 1 y 2), mediante
// supabase.auth.signInWithPassword. No hace falta ninguna tabla ni función nueva en el
// servidor: Supabase Auth ya valida la contraseña.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  // El bloque de ConfigOpciones es el único que se toca.
  const inicio = contenido.indexOf("function ConfigOpciones(");
  const fin = contenido.indexOf("\nfunction ConfigPermisos(", inicio);
  assert.ok(inicio > 0 && fin > inicio, `${nombre}: no se pudo delimitar ConfigOpciones`);
  const bloque = contenido.slice(inicio, fin);

  assert.match(bloque, /const \[clave, setClave\] = \(0, import_react4\.useState\)\(""\);/, `${nombre}: falta el estado de la contraseña de confirmación`);

  assert.match(bloque, /const confirmarClave = async \(\) => \{/, `${nombre}: falta confirmarClave`);
  assert.match(bloque, /const claveActual = clave;\s*\n\s*setClave\(""\);/, `${nombre}: la contraseña debe vaciarse del estado en cuanto se usa, no quedarse en pantalla`);
  assert.match(
    bloque,
    /supabase\.auth\.signInWithPassword\(\{ email: correo, password: claveActual \}\)/,
    `${nombre}: debe reconfirmar reautenticando con la propia contraseña de quien edita (nunca pedir la de otra persona)`
  );
  assert.match(bloque, /setError\("Contraseña incorrecta\."\);/, `${nombre}: falta el mensaje de contraseña incorrecta`);

  // Las 3 funciones de guardado (grupo, opción, vínculo) deben pedir la clave justo antes de
  // llamar al servidor, después de validar los demás campos (para no gastar una comprobación
  // de red si el formulario está incompleto).
  for (const funcion of ["abc_guardar_grupo_opciones", "abc_guardar_opcion", "abc_vincular_grupo_producto"]) {
    const posRpc = bloque.indexOf(`configRpc("${funcion}", {`);
    assert.ok(posRpc > 0, `${nombre}: no se encontró la llamada a ${funcion}`);
    const antes = bloque.slice(0, posRpc);
    const posClave = antes.lastIndexOf("if (!(await confirmarClave())) return false;");
    const posGuardando = antes.lastIndexOf("setGuardando(true);");
    assert.ok(posClave > 0, `${nombre}: ${funcion} debe pedir confirmarClave antes de guardar`);
    assert.ok(posGuardando > posClave, `${nombre}: ${funcion} debe pedir la clave antes de marcar "guardando"`);
  }

  // El campo de contraseña en pantalla dice explícitamente que es la propia, no la de otra
  // persona, y nunca se preintegra con la de requiereMotivo (son dos confirmaciones
  // independientes: motivo + contraseña).
  assert.match(
    bloque,
    /Field, \{ label: "Confirma tu contraseña \(la tuya, para guardar cambios en esta biblioteca\)" \}/,
    `${nombre}: falta el campo de contraseña en pantalla, dejando claro que es la propia`
  );
  assert.match(bloque, /type: "password", value: clave, onChange: \(e2\) => setClave\(e2\.target\.value\)/, `${nombre}: falta el input de contraseña controlado`);
}

// Dual-file parity ya la cubre el test de la pieza 1 (etapa6-t8-biblioteca-opciones-contract.mjs)
// sobre el bloque completo de ConfigOpciones; aquí solo se verifica que este cambio está
// presente en ambos archivos con el mismo texto exacto.
{
  const inicioFuente = fuente.indexOf("const confirmarClave = async () => {");
  const inicioEspejo = espejo.indexOf("const confirmarClave = async () => {");
  assert.ok(inicioFuente > 0 && inicioEspejo > 0, "confirmarClave debe existir en ambos archivos");
  const finFuente = fuente.indexOf("  const enviarGrupo = async (datos, mensaje) => {", inicioFuente);
  const finEspejo = espejo.indexOf("  const enviarGrupo = async (datos, mensaje) => {", inicioEspejo);
  assert.equal(
    fuente.slice(inicioFuente, finFuente),
    espejo.slice(inicioEspejo, finEspejo),
    "confirmarClave debe ser idéntico entre fuente.js y el espejo de recuperación"
  );
}

console.log("PLAN_MAESTRO_ETAPA6_T8_CLAVE_PROPIETARIO=PASS");
